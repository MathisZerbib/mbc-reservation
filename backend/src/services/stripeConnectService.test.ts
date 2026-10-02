import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
// Prisma is fully mocked: these specs never touch a database (plain
// `npm test` stays DB-free; DB suites remain opt-in behind RUN_DB_TESTS=1).
vi.mock('../lib/prisma', () => ({
    prisma: {
        booking: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
        tenant: { findUnique: vi.fn() },
        stripeWebhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    },
}));

// The Stripe SDK is injected via the service's test seam
// (__setStripeClientForTests) — no network, no require() interop involved.
import { prisma } from '../lib/prisma';
import {
    __setStripeClientForTests,
    applicationFeeParam,
    captureNoShow,
    createReservationHold,
    getUnresolvedHolds,
    handleConnectWebhook,
    processConnectWebhookEvent,
    releaseHold,
    verifyConnectSignature,
} from './stripeConnectService';

const db = prisma as any;

const stripeFake = {
    webhooks: { constructEvent: vi.fn() },
    paymentIntents: { create: vi.fn(), capture: vi.fn(), cancel: vi.fn() },
};

const CONNECT_A = 'acct_restaurant_A';
const CONNECT_B = 'acct_restaurant_B';

const heldRow = (overrides = {}) => ({
    id: 'booking-1',
    tenantId: 'tenant-1',
    depositStatus: 'HELD',
    depositAmountCents: 2000,
    stripePaymentIntentId: 'pi_123',
    stripeCheckoutSessionId: 'cs_123',
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_test';
    __setStripeClientForTests(stripeFake);
    db.stripeWebhookEvent.findUnique.mockResolvedValue(null); // no replay by default
    db.stripeWebhookEvent.create.mockResolvedValue({ id: 'evt-row' });
});

// ── Signature verification (single platform Connect secret) ──────────────

describe('verifyConnectSignature', () => {
    it('rejects tampered/forged payloads (constructEvent throws → INVALID_SIGNATURE)', () => {
        stripeFake.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('No signatures found matching the expected signature');
        });
        const err = (() => {
            try {
                verifyConnectSignature(Buffer.from('{" forged": true }'), 't=1,v1=deadbeef');
            } catch (e) {
                return e as any;
            }
        })();
        expect(err?.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects a missing stripe-signature header without calling the SDK', () => {
        const err = (() => {
            try {
                verifyConnectSignature(Buffer.from('{}'), undefined);
            } catch (e) {
                return e as any;
            }
        })();
        expect(err?.code).toBe('INVALID_SIGNATURE');
        expect(stripeFake.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('fails closed when STRIPE_CONNECT_WEBHOOK_SECRET is not configured', () => {
        delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
        const err = (() => {
            try {
                verifyConnectSignature(Buffer.from('{}'), 't=1,v1=abc');
            } catch (e) {
                return e as any;
            }
        })();
        expect(err?.code).toBe('WEBHOOK_MISCONFIGURED');
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_test';
    });

    it('handleConnectWebhook surfaces INVALID_SIGNATURE so the route can 400 + alert', async () => {
        stripeFake.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('bad signature');
        });
        await expect(handleConnectWebhook(Buffer.from('{}'), 't=1,v1=nope')).rejects.toMatchObject({
            code: 'INVALID_SIGNATURE',
        });
    });
});

// ── Strict multi-tenant isolation ────────────────────────────────────────

describe('tenant binding (event.account vs booking tenant)', () => {
    const succeededEvent = (account: string) => ({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        account,
        data: { object: { id: 'pi_123', metadata: { bookingId: 'booking-1' } } },
    });

    it('DROPS the event when event.account !== booking tenant stripeAccountId (cross-contamination)', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow());
        db.tenant.findUnique.mockResolvedValue({
            id: 'tenant-1',
            settings: { stripeAccountId: CONNECT_A },
        });
        const outcome = await processConnectWebhookEvent(succeededEvent(CONNECT_B) as any);
        expect(outcome).toBe('DROPPED_MISMATCH');
        expect(db.booking.update).not.toHaveBeenCalled();
    });

    it('APPLIES the event when event.account matches the tenant account', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow());
        db.tenant.findUnique.mockResolvedValue({
            id: 'tenant-1',
            settings: { stripeAccountId: CONNECT_A },
        });
        const outcome = await processConnectWebhookEvent(succeededEvent(CONNECT_A) as any);
        expect(outcome).toBe('APPLIED');
        expect(db.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { depositStatus: 'CAPTURED' },
        });
    });
});

// ── Idempotency / double delivery ────────────────────────────────────────

describe('idempotency (Stripe redeliveries)', () => {
    const holdEvent = (type: string, id = 'evt_replay') => ({
        id,
        type,
        account: CONNECT_A,
        data: { object: { id: 'pi_123', metadata: { bookingId: 'booking-1' } } },
    });

    it('returns DUPLICATE immediately when the event id was already processed (no DB write)', async () => {
        db.stripeWebhookEvent.findUnique.mockResolvedValue({ eventId: 'evt_replay', outcome: 'APPLIED' });
        const outcome = await processConnectWebhookEvent(holdEvent('payment_intent.succeeded') as any);
        expect(outcome).toBe('DUPLICATE');
        expect(db.booking.findUnique).not.toHaveBeenCalled();
        expect(db.booking.update).not.toHaveBeenCalled();
    });

    it('HELD → CAPTURED webhook on an already-CAPTURED booking is a no-op 200 (linear guard)', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow({ depositStatus: 'CAPTURED' }));
        db.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', settings: { stripeAccountId: CONNECT_A } });
        const outcome = await processConnectWebhookEvent(holdEvent('payment_intent.succeeded') as any);
        expect(outcome).toBe('DUPLICATE');
        expect(db.booking.update).not.toHaveBeenCalled();
    });

    it('canceled webhook on an already-RELEASED booking never moves it', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow({ depositStatus: 'RELEASED' }));
        db.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', settings: { stripeAccountId: CONNECT_A } });
        const outcome = await processConnectWebhookEvent(
            { ...holdEvent('payment_intent.canceled'), data: { object: { id: 'pi_123', cancellation_reason: 'requested_by_customer', metadata: { bookingId: 'booking-1' } } } } as any,
        );
        expect(outcome).toBe('DUPLICATE');
        expect(db.booking.update).not.toHaveBeenCalled();
    });
});

// ── Fail-safe state machine ──────────────────────────────────────────────

describe('fail-safe transitions', () => {
    const bindTenant = () =>
        db.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', settings: { stripeAccountId: CONNECT_A } });

    it('PENDING → HELD on amount_capturable_updated (authorization observed, never captured)', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow({ depositStatus: 'PENDING' }));
        bindTenant();
        const outcome = await processConnectWebhookEvent({
            id: 'evt_hold',
            type: 'payment_intent.amount_capturable_updated',
            account: CONNECT_A,
            data: { object: { id: 'pi_123', metadata: { bookingId: 'booking-1' } } },
        } as any);
        expect(outcome).toBe('APPLIED');
        expect(db.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { depositStatus: 'HELD', stripePaymentIntentId: 'pi_123' },
        });
        expect(stripeFake.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it('native Stripe expiry maps to EXPIRED (never CAPTURED) when cancellation_reason=expired', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow());
        bindTenant();
        const outcome = await processConnectWebhookEvent({
            id: 'evt_exp',
            type: 'payment_intent.canceled',
            account: CONNECT_A,
            data: { object: { id: 'pi_123', cancellation_reason: 'expired', metadata: { bookingId: 'booking-1' } } },
        } as any);
        expect(outcome).toBe('APPLIED');
        expect(db.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { depositStatus: 'EXPIRED' },
        });
        expect(stripeFake.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it('staff release maps to RELEASED when cancellation_reason is not expired', async () => {
        db.booking.findUnique.mockResolvedValue(heldRow());
        bindTenant();
        const outcome = await processConnectWebhookEvent({
            id: 'evt_rel',
            type: 'payment_intent.canceled',
            account: CONNECT_A,
            data: { object: { id: 'pi_123', cancellation_reason: 'requested_by_customer', metadata: { bookingId: 'booking-1' } } },
        } as any);
        expect(outcome).toBe('APPLIED');
        expect(db.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: { depositStatus: 'RELEASED' },
        });
    });

    it('captureNoShow refuses anything but HELD (fail-safe: only explicit staff action captures)', async () => {
        for (const status of ['PENDING', 'RELEASED', 'CAPTURED', 'EXPIRED', 'FAILED', 'NONE']) {
            const res = await captureNoShow(heldRow({ depositStatus: status }) as any, { stripeAccountId: CONNECT_A, stripeOnboarded: true });
            expect(res).toBe('NOOP');
        }
        expect(stripeFake.paymentIntents.capture).not.toHaveBeenCalled();
    });

    it('captureNoShow captures a HELD hold on the Connect account', async () => {
        stripeFake.paymentIntents.capture.mockResolvedValue({ id: 'pi_123', status: 'succeeded' });
        db.booking.update.mockResolvedValue(heldRow({ depositStatus: 'CAPTURED' }));
        const res = await captureNoShow(heldRow() as any, { stripeAccountId: CONNECT_A, stripeOnboarded: true });
        expect(res).toBe('CAPTURED');
        expect(stripeFake.paymentIntents.capture).toHaveBeenCalledWith('pi_123', { stripeAccount: CONNECT_A });
    });

    it('releaseHold is a NOOP on terminal states (double-click / webhook race safe)', async () => {
        for (const status of ['CAPTURED', 'RELEASED', 'EXPIRED', 'FAILED']) {
            const res = await releaseHold(heldRow({ depositStatus: status }) as any, { stripeAccountId: CONNECT_A, stripeOnboarded: true });
            expect(res).toBe('NOOP');
        }
        expect(stripeFake.paymentIntents.cancel).not.toHaveBeenCalled();
        expect(db.booking.update).not.toHaveBeenCalled();
    });

    it('createReservationHold opens a MANUAL-capture PI as a direct Connect charge with zero fee', async () => {
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        stripeFake.paymentIntents.create.mockResolvedValue({ id: 'pi_new', client_secret: 'secret_new' });
        db.booking.update.mockResolvedValue(heldRow({ depositStatus: 'PENDING', stripePaymentIntentId: 'pi_new' }));
        const res = await createReservationHold('booking-1', 'tenant-1', 2000, { stripeAccountId: CONNECT_A, stripeOnboarded: true });
        expect(res.paymentIntentId).toBe('pi_new');
        const [params, opts] = stripeFake.paymentIntents.create.mock.calls[0];
        expect(params.capture_method).toBe('manual'); // hold, not a charge
        expect(params.application_fee_amount).toBeUndefined(); // launch phase: zero commission
        expect(opts.stripeAccount).toBe(CONNECT_A); // direct charge on the restaurant
        expect(db.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-1' },
            data: expect.objectContaining({ depositStatus: 'PENDING', depositAmountCents: 2000, stripePaymentIntentId: 'pi_new' }),
        });
    });
});

// ── Commission toggle + reconciliation ───────────────────────────────────

describe('platform fee + reconciliation', () => {
    it('defaults to zero platform commission (launch phase)', () => {
        expect(applicationFeeParam()).toEqual({});
    });

    it('getUnresolvedHolds queries HELD bookings from the last 24h for one tenant', async () => {
        db.booking.findMany.mockResolvedValue([]);
        await getUnresolvedHolds('tenant-1');
        expect(db.booking.findMany).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-1',
                deletedAt: null,
                depositStatus: 'HELD',
                startTime: { gte: expect.any(Date) },
            },
            orderBy: { startTime: 'asc' },
            select: expect.objectContaining({ id: true, stripePaymentIntentId: true }),
        });
        const since: Date = db.booking.findMany.mock.calls[0][0].where.startTime.gte;
        expect(Date.now() - since.getTime()).toBeLessThan(25 * 3600 * 1000);
        expect(Date.now() - since.getTime()).toBeGreaterThan(23 * 3600 * 1000);
    });
});
