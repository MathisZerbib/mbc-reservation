import { prisma } from '../lib/prisma';

export const DEPOSIT_STATUSES = ['NONE', 'PENDING', 'HELD', 'CAPTURED', 'RELEASED', 'EXPIRED', 'FAILED'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const MIN_DEPOSIT_EUR = 1;
export const MAX_DEPOSIT_EUR = 500;

/** Stripe is usable only with a secret key (test or live). Without it, deposits stay NONE. */
export function isStripeEnabled(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
}

function stripeClient(): any {
    // Lazy so the backend boots (and tests run) without the SDK/key.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

/** Pure rule: hold required for parties at/above the threshold when enabled. */
export function depositRequired(depositEnabled: boolean, depositMinSize: number, size: number): boolean {
    return depositEnabled && size >= depositMinSize;
}

export function parseDepositAmount(input: unknown): number {
    const value = typeof input === 'string' ? Number(input) : (input as number);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('depositAmount must be a number');
    }
    if (value < MIN_DEPOSIT_EUR || value > MAX_DEPOSIT_EUR) {
        throw new Error(`depositAmount must be between ${MIN_DEPOSIT_EUR} and ${MAX_DEPOSIT_EUR} euros`);
    }
    return Math.round(value * 100) / 100;
}

export interface DepositHoldUrls {
    successUrl: string;
    cancelUrl: string;
}

type DepositRow = {
    id: string;
    tenantId: string;
    depositStatus: string;
    depositAmountCents: number | null;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
};

/** Per-restaurant Connect settings driving direct charges (null = not connected). */
export interface ConnectSettings {
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
}

/**
 * Maps Stripe onboarding failures to actionable API responses. In
 * particular, creating Connect accounts requires an ACTIVATED platform
 * account — otherwise Stripe answers 500-grade errors that mean "go finish
 * business onboarding", not "retry".
 */
export function connectErrorResponse(e: unknown): { status: number; error: string } {
    const msg = e instanceof Error ? e.message : String(e);
    if (/must be activated/i.test(msg)) {
        return {
            status: 400,
            error: 'Stripe platform account is not activated. Complete business onboarding at dashboard.stripe.com/account/onboarding, then retry.',
        };
    }
    return { status: 500, error: 'Failed to start Stripe onboarding' };
}

/**
 * Creates (or reuses) the restaurant's Express account and returns a fresh
 * onboarding link. The restaurant completes KYC on Stripe, then returns to
 * `returnUrl`; Stripe re-calls `refreshUrl` if the link expires.
 */
export async function createOnboardingLink(
    tenantId: string,
    restaurantName: string,
    email: string | null,
    settings: ConnectSettings,
    urls: { returnUrl: string; refreshUrl: string },
): Promise<{ url: string; accountId: string }> {
    const stripe = stripeClient();
    let accountId = settings.stripeAccountId;
    if (!accountId) {
        const account = await stripe.accounts.create({
            type: 'express',
            country: 'FR',
            email: email ?? undefined,
            business_profile: { name: restaurantName },
            metadata: { tenantId },
        });
        accountId = account.id;
        await prisma.restaurantSettings.upsert({
            where: { tenantId },
            update: { stripeAccountId: accountId },
            create: { tenantId, stripeAccountId: accountId },
        });
    }
    const link = await stripe.accountLinks.create({
        account: accountId as string,
        refresh_url: urls.refreshUrl,
        return_url: urls.returnUrl,
        type: 'account_onboarding',
    });
    return { url: link.url, accountId: accountId as string };
}

/** Refreshes the onboarded flag from Stripe (charges enabled). */
export async function refreshOnboardingStatus(tenantId: string, settings: ConnectSettings): Promise<boolean> {
    if (!settings.stripeAccountId) return false;
    const account = await stripeClient().accounts.retrieve(settings.stripeAccountId);
    const onboarded = account.charges_enabled === true;
    if (onboarded !== settings.stripeOnboarded) {
        await prisma.restaurantSettings.upsert({
            where: { tenantId },
            update: { stripeOnboarded: onboarded },
            create: { tenantId, stripeOnboarded: onboarded },
        });
    }
    return onboarded;
}

/**
 * Opens a Stripe Checkout hold (manual capture — no charge until a
 * no-show capture). Direct charge on the restaurant's Connect account when
 * provided, platform account otherwise. Marks the booking PENDING and
 * returns the hosted URL. Throws on Stripe errors (caller fails the
 * deposit open, booking stands).
 */
export async function createDepositHold(
    bookingId: string,
    tenantId: string,
    amountCents: number,
    urls: DepositHoldUrls,
    connect?: ConnectSettings | null,
): Promise<{ url: string }> {
    const stripe = stripeClient();
    const opts = connect?.stripeAccountId ? { stripeAccount: connect.stripeAccountId } : undefined;
    const session = await stripe.checkout.sessions.create(
        {
            mode: 'payment',
            payment_intent_data: { capture_method: 'manual' },
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: { name: 'Deposit hold — released after your visit' },
                        unit_amount: amountCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: { bookingId, tenantId },
            success_url: urls.successUrl,
            cancel_url: urls.cancelUrl,
            expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
        },
        opts as any,
    );
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            depositStatus: 'PENDING',
            depositAmountCents: amountCents,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
        } as any,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
}

/** Releases a HELD/PENDING hold (guest came, or timely cancel). Best-effort safe. */
export async function releaseDeposit(row: DepositRow, connect?: ConnectSettings | null): Promise<void> {
    if (!isStripeEnabled()) return;
    if ((row.depositStatus !== 'HELD' && row.depositStatus !== 'PENDING') || !row.stripePaymentIntentId) return;
    try {
        const opts = connect?.stripeAccountId ? { stripeAccount: connect.stripeAccountId } : undefined;
        await stripeClient().paymentIntents.cancel(row.stripePaymentIntentId, opts as any);
    } catch (e) {
        // Already captured/canceled on Stripe's side — still mark released.
        console.error('Stripe release failed (marking released anyway):', (e as Error).message);
    }
    await prisma.booking.update({ where: { id: row.id }, data: { depositStatus: 'RELEASED' } as any });
}

/** Captures a HELD hold (no-show). No-op unless HELD. */
export async function captureDeposit(row: DepositRow, connect?: ConnectSettings | null): Promise<void> {
    if (!isStripeEnabled()) return;
    if (row.depositStatus !== 'HELD' || !row.stripePaymentIntentId) return;
    const opts = connect?.stripeAccountId ? { stripeAccount: connect.stripeAccountId } : undefined;
    await stripeClient().paymentIntents.capture(row.stripePaymentIntentId, opts as any);
    await prisma.booking.update({ where: { id: row.id }, data: { depositStatus: 'CAPTURED' } as any });
}

/** Webhook: checkout completed → HELD; expired/failed → FAILED. */
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    const event = stripeClient().webhooks.constructEvent(rawBody, signature, secret);
    const session = event.data?.object as any;
    const bookingId = session?.metadata?.bookingId as string | undefined;
    if (!bookingId) return;
    if (event.type === 'checkout.session.completed') {
        const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        await prisma.booking.update({
            where: { id: bookingId },
            data: { depositStatus: 'HELD', stripePaymentIntentId: paymentIntentId } as any,
        });
    } else if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
        await prisma.booking.update({
            where: { id: bookingId },
            data: { depositStatus: 'FAILED' } as any,
        });
    }
}
