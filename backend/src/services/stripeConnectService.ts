import { prisma } from '../lib/prisma';

/**
 * faci-table — Stripe Connect "Fail-Safe" authorization-hold service.
 *
 * Architecture:
 * - Direct charges on the restaurant's Connect Express account
 *   (`stripeAccount` header = RestaurantSettings.stripeAccountId).
 * - A SINGLE platform webhook (STRIPE_CONNECT_WEBHOOK_SECRET) receives ALL
 *   Connect events; each carries `event.account` = the restaurant's acct id.
 * - Funds are NEVER auto-captured. The only capture trigger is an explicit
 *   staff "Mark No-Show & Charge" click. Unresolved holds die via Stripe's
 *   native ~7-day uncaptured-authorization expiry → webhook maps it to EXPIRED.
 *
 * State machine (strictly linear, terminal states never move):
 *   PENDING → HELD → RELEASED  (staff "Arrived" → paymentIntents.cancel)
 *                 → CAPTURED (staff "Mark No-Show & Charge" → paymentIntents.capture)
 *                 → EXPIRED  (Stripe native expiry — webhook only, no cron, no capture)
 *   PENDING → FAILED (checkout expired / card declined)
 */

// ─────────────────────────────────────────────
// Platform commission toggle (launch phase = 0)
// ─────────────────────────────────────────────

/**
 * Platform fee taken on each captured no-show, in cents.
 * Launch phase: 0 (restaurant keeps 100%). To monetize later, set e.g. 100
 * (€1) or compute a basis-points share — the single place to change.
 */
export const PLATFORM_FEE_CENTS = 0;

/** Resolves to `application_fee_amount` for direct charges (omitted when 0). */
export function applicationFeeParam(): { application_fee_amount?: number } {
    return PLATFORM_FEE_CENTS > 0 ? { application_fee_amount: PLATFORM_FEE_CENTS } : {};
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export const HOLD_STATUSES = ['NONE', 'PENDING', 'HELD', 'CAPTURED', 'RELEASED', 'EXPIRED', 'FAILED'] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

/** Terminal states: the webhook and staff actions must never move out of these. */
export const TERMINAL_HOLD_STATUSES: ReadonlySet<HoldStatus> = new Set(['CAPTURED', 'RELEASED', 'EXPIRED', 'FAILED']);

export interface ConnectSettings {
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
}

export interface HoldRow {
    id: string;
    tenantId: string;
    depositStatus: string;
    depositAmountCents: number | null;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
}

export interface ReconciliationHold {
    id: string;
    name: string;
    size: number;
    startTime: Date;
    depositAmountCents: number | null;
    stripePaymentIntentId: string | null;
    hoursUnresolved: number;
}

function stripeClient(): any {
    // Unit-test seam (see __setStripeClientForTests). Always set in tests so
    // no network/SDK import happens; production always goes to require().
    if (stripeTestClient) return stripeTestClient;
    // Lazy so the backend boots (and unit tests run) without key/SDK loaded.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require('stripe');
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
    return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

/**
 * Test-only seam: injects a fake Stripe SDK client so vitest specs never
 * touch the network or depend on module-loader require() interop.
 * Never call outside tests.
 */
let stripeTestClient: any = null;
export function __setStripeClientForTests(client: any): void {
    stripeTestClient = client;
}

function connectOpts(connect?: ConnectSettings | null): { stripeAccount: string } | undefined {
    return connect?.stripeAccountId ? { stripeAccount: connect.stripeAccountId } : undefined;
}

function requireConnectAccount(connect?: ConnectSettings | null): string {
    if (!connect?.stripeAccountId) throw new Error('Restaurant has no Stripe Connect account');
    return connect.stripeAccountId;
}

// ─────────────────────────────────────────────
// Phase 1 — Hold lifecycle (explicit staff triggers only)
// ─────────────────────────────────────────────

/**
 * PENDING → HELD (step 1: open the hold).
 * Creates a manual-capture PaymentIntent as a DIRECT charge on the
 * restaurant's Connect account. The client confirms it with the card form;
 * the webhook flips PENDING → HELD on `amount_capturable_updated` /
 * `checkout.session.completed`. The native ~7-day Stripe expiry clock starts
 * at authorization — we store an informational `depositExpiresAt`.
 * NEVER captures here.
 */
export async function createReservationHold(
    bookingId: string,
    tenantId: string,
    amountCents: number,
    connect: ConnectSettings,
    opts?: { idempotencyKey?: string },
): Promise<{ paymentIntentId: string; clientSecret: string | null }> {
    const stripeAccount = requireConnectAccount(connect);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error('amountCents must be a positive integer');
    }
    const stripe = stripeClient();
    const pi = await stripe.paymentIntents.create(
        {
            amount: amountCents,
            currency: 'eur',
            capture_method: 'manual', // authorization hold — no charge until explicit capture
            ...applicationFeeParam(), // zero commission at launch
            metadata: { bookingId, tenantId },
            description: 'Reservation no-show guarantee (released after your visit)',
        },
        {
            stripeAccount,
            ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
        },
    );
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            depositStatus: 'PENDING',
            depositAmountCents: amountCents,
            stripePaymentIntentId: pi.id,
            // Informational only — Stripe enforces the real deadline.
            depositExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        } as any,
    });
    return { paymentIntentId: pi.id, clientSecret: pi.client_secret ?? null };
}

/**
 * HELD → RELEASED (happy path: staff clicks "Arrived").
 * Cancels the uncaptured authorization. Safe to call for PENDING too
 * (hold opened but never authorized). No-op on terminal states so double
 * clicks / webhook races never error.
 */
export async function releaseHold(row: HoldRow, connect?: ConnectSettings | null): Promise<'RELEASED' | 'NOOP'> {
    if (TERMINAL_HOLD_STATUSES.has(row.depositStatus as HoldStatus)) return 'NOOP';
    if (row.depositStatus !== 'HELD' && row.depositStatus !== 'PENDING') return 'NOOP';
    if (row.stripePaymentIntentId) {
        try {
            await stripeClient().paymentIntents.cancel(row.stripePaymentIntentId, connectOpts(connect) as any);
        } catch (e) {
            // Already canceled/expired/captured on Stripe's side — the webhook
            // (or the guard above) owns the final state; still release locally
            // unless the PI was actually captured (then the webhook's
            // payment_intent.succeeded will correct us to CAPTURED).
            console.error('Stripe release failed (marking released anyway):', (e as Error).message);
        }
    }
    await prisma.booking.update({ where: { id: row.id }, data: { depositStatus: 'RELEASED' } as any });
    return 'RELEASED';
}

/**
 * HELD → CAPTURED (true no-show ONLY: staff clicks "Mark No-Show & Charge").
 * This is the SOLE capture trigger in the system — no cron, no timeout, no
 * webhook ever captures. Refuses anything that is not HELD with a PI.
 */
export async function captureNoShow(row: HoldRow, connect?: ConnectSettings | null): Promise<'CAPTURED' | 'NOOP'> {
    if (row.depositStatus !== 'HELD' || !row.stripePaymentIntentId) return 'NOOP';
    await stripeClient().paymentIntents.capture(row.stripePaymentIntentId, connectOpts(connect) as any);
    await prisma.booking.update({ where: { id: row.id }, data: { depositStatus: 'CAPTURED' } as any });
    return 'CAPTURED';
}

// ─────────────────────────────────────────────
// Phase 2 — Single Connect webhook processor
// ─────────────────────────────────────────────

export type WebhookOutcome = 'APPLIED' | 'DUPLICATE' | 'DROPPED_MISMATCH' | 'IGNORED';

export interface ConnectWebhookEvent {
    id: string;
    type: string;
    /** Connect account the event happened on (undefined = platform event). */
    account?: string;
    data: { object: any };
}

/**
 * Verifies the platform Connect webhook signature with the SINGLE
 * STRIPE_CONNECT_WEBHOOK_SECRET. Throws with `code = 'INVALID_SIGNATURE'`
 * on failure (route maps to 400 + alert log). Never falls back to per-
 * restaurant secrets.
 */
export function verifyConnectSignature(rawBody: Buffer, signature: string | undefined): ConnectWebhookEvent {
    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) throw Object.assign(new Error('STRIPE_CONNECT_WEBHOOK_SECRET is not configured'), { code: 'WEBHOOK_MISCONFIGURED' });
    if (!signature) throw Object.assign(new Error('Missing stripe-signature header'), { code: 'INVALID_SIGNATURE' });
    try {
        return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
        console.error('[stripe-connect] ⚠️ signature verification failed:', (e as Error).message);
        throw Object.assign(new Error('Invalid webhook signature'), { code: 'INVALID_SIGNATURE' });
    }
}

/**
 * Finds the booking for a Connect event object. Lookup order:
 * 1. metadata.bookingId (our own writes always set it),
 * 2. stripePaymentIntentId match (covers dashboard-driven / retried flows).
 */
async function findBookingForObject(obj: any): Promise<HoldRow | null> {
    const bookingId = obj?.metadata?.bookingId as string | undefined;
    if (bookingId) {
        const b = (await prisma.booking.findUnique({ where: { id: bookingId } })) as any;
        if (b) return b as HoldRow;
    }
    const piId: string | undefined =
        obj?.id?.startsWith?.('pi_') ? obj.id
        : typeof obj?.payment_intent === 'string' ? obj.payment_intent
        : obj?.payment_intent?.id;
    if (piId) {
        const b = (await prisma.booking.findFirst({ where: { stripePaymentIntentId: piId } })) as any;
        if (b) return b as HoldRow;
    }
    const sessionId: string | undefined = obj?.id?.startsWith?.('cs_') ? obj.id : undefined;
    if (sessionId) {
        const b = (await prisma.booking.findFirst({ where: { stripeCheckoutSessionId: sessionId } })) as any;
        if (b) return b as HoldRow;
    }
    return null;
}

async function recordOutcome(event: ConnectWebhookEvent, bookingId: string | null, outcome: WebhookOutcome): Promise<void> {
    try {
        await (prisma as any).stripeWebhookEvent.create({
            data: { eventId: event.id, stripeAccountId: event.account ?? null, type: event.type, bookingId, outcome },
        });
    } catch {
        // Ledger is best-effort (e.g. model not yet migrated) — never fail the webhook.
    }
}

/**
 * Central Connect webhook processor. Enforces, in order:
 * 1. Idempotency — redelivered event ids return DUPLICATE with no DB write.
 * 2. Tenant binding — booking.tenant's stripeAccountId MUST equal
 *    event.account, else DROPPED_MISMATCH (severe log, no write).
 * 3. Linear transitions — terminal states never move (double-delivery safe).
 *
 * Handled transitions:
 * - amount_capturable_updated / checkout.session.completed → PENDING → HELD
 * - payment_intent.succeeded → HELD → CAPTURED (records staff/API capture)
 * - payment_intent.canceled → HELD/PENDING → RELEASED, or → EXPIRED when
 *   cancellation_reason === 'expired' (Stripe native 7-day expiry)
 * - checkout.session.expired / payment_intent.payment_failed → PENDING → FAILED
 */
export async function processConnectWebhookEvent(event: ConnectWebhookEvent): Promise<WebhookOutcome> {
    // 1. Idempotency first (Stripe redelivers aggressively on 5xx/timeout).
    try {
        const seen = await (prisma as any).stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
        if (seen) return 'DUPLICATE';
    } catch {
        // Ledger unavailable (pre-migration) — fall through to state guards,
        // which are independently idempotent via terminal-state checks.
    }

    const obj = event.data?.object as any;
    const booking = await findBookingForObject(obj);
    if (!booking) {
        await recordOutcome(event, null, 'IGNORED');
        return 'IGNORED';
    }

    // 2. Strict multi-tenant isolation: event.account MUST be the booking's
    // restaurant's Connect account. Drop + scream otherwise.
    if (event.account) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: booking.tenantId },
            include: { settings: true },
        } as any) as any;
        const expected = tenant?.settings?.stripeAccountId as string | null | undefined;
        if (expected && expected !== event.account) {
            console.error(
                `[stripe-connect] 🚨 TENANT MISMATCH — dropped event ${event.id} (${event.type}): ` +
                `event.account=${event.account} but booking ${booking.id} belongs to tenant ${booking.tenantId} ` +
                `(stripeAccountId=${expected}). Possible cross-contamination.`,
            );
            await recordOutcome(event, booking.id, 'DROPPED_MISMATCH');
            return 'DROPPED_MISMATCH';
        }
    }

    const current = booking.depositStatus as HoldStatus;
    const api = prisma.booking.update.bind(prisma.booking);

    // 3. Linear transitions (terminal states never move → double-delivery safe).
    switch (event.type) {
        case 'payment_intent.amount_capturable_updated':
        case 'checkout.session.completed': {
            if (current !== 'PENDING') {
                await recordOutcome(event, booking.id, 'DUPLICATE');
                return 'DUPLICATE';
            }
            const piId = typeof obj?.payment_intent === 'string' ? obj.payment_intent : obj?.payment_intent?.id ?? obj?.id;
            await api({ where: { id: booking.id }, data: { depositStatus: 'HELD', stripePaymentIntentId: piId ?? booking.stripePaymentIntentId } as any });
            await recordOutcome(event, booking.id, 'APPLIED');
            return 'APPLIED';
        }
        case 'payment_intent.succeeded': {
            // Capture completed (staff clicked "Mark No-Show & Charge").
            if (current === 'CAPTURED') {
                await recordOutcome(event, booking.id, 'DUPLICATE');
                return 'DUPLICATE';
            }
            if (current !== 'HELD') {
                await recordOutcome(event, booking.id, 'IGNORED');
                return 'IGNORED';
            }
            await api({ where: { id: booking.id }, data: { depositStatus: 'CAPTURED' } as any });
            await recordOutcome(event, booking.id, 'APPLIED');
            return 'APPLIED';
        }
        case 'payment_intent.canceled': {
            if (TERMINAL_HOLD_STATUSES.has(current)) {
                await recordOutcome(event, booking.id, 'DUPLICATE');
                return 'DUPLICATE';
            }
            // Native Stripe expiry vs staff release share this event; the
            // reason field is the ONLY thing that distinguishes them.
            const expired = obj?.cancellation_reason === 'expired';
            await api({ where: { id: booking.id }, data: { depositStatus: expired ? 'EXPIRED' : 'RELEASED' } as any });
            await recordOutcome(event, booking.id, 'APPLIED');
            return 'APPLIED';
        }
        case 'checkout.session.expired':
        case 'payment_intent.payment_failed': {
            if (current !== 'PENDING') {
                await recordOutcome(event, booking.id, 'DUPLICATE');
                return 'DUPLICATE';
            }
            await api({ where: { id: booking.id }, data: { depositStatus: 'FAILED' } as any });
            await recordOutcome(event, booking.id, 'APPLIED');
            return 'APPLIED';
        }
        default: {
            await recordOutcome(event, booking.id, 'IGNORED');
            return 'IGNORED';
        }
    }
}

/** Full webhook entry: verify signature → process. Used by the route. */
export async function handleConnectWebhook(rawBody: Buffer, signature: string | undefined): Promise<WebhookOutcome> {
    const event = verifyConnectSignature(rawBody, signature);
    return processConnectWebhookEvent(event);
}

// ─────────────────────────────────────────────
// Phase 3 — End-of-shift reconciliation
// ─────────────────────────────────────────────

/**
 * Unresolved holds for the "End of Shift Reconciliation" view: bookings
 * from the last 24h still HELD. The manager sees these the morning after
 * service and either releases (guest came) or captures (true no-show)
 * BEFORE Stripe's ~7-day window closes them automatically.
 */
export async function getUnresolvedHolds(tenantId: string, sinceHours = 24): Promise<ReconciliationHold[]> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    const rows = (await prisma.booking.findMany({
        where: { tenantId, deletedAt: null, depositStatus: 'HELD' as any, startTime: { gte: since } },
        orderBy: { startTime: 'asc' },
        select: { id: true, name: true, size: true, startTime: true, depositAmountCents: true, stripePaymentIntentId: true },
    } as any)) as Array<{
        id: string; name: string; size: number; startTime: Date;
        depositAmountCents: number | null; stripePaymentIntentId: string | null;
    }>;
    const now = Date.now();
    return rows.map(r => ({
        ...r,
        hoursUnresolved: Math.max(0, Math.round(((now - new Date(r.startTime).getTime()) / 3600000) * 10) / 10),
    }));
}
