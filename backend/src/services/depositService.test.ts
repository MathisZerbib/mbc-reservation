import { describe, it, expect } from 'vitest';

import { depositRequired, parseDepositAmount, isStripeEnabled, connectErrorResponse, stripeMode } from './depositService';

describe('depositRequired', () => {
    it('requires a hold when enabled and size meets the threshold', () => {
        expect(depositRequired(true, 6, 6)).toBe(true);
        expect(depositRequired(true, 6, 8)).toBe(true);
        expect(depositRequired(true, 6, 5)).toBe(false);
        expect(depositRequired(false, 6, 10)).toBe(false);
    });
});

describe('parseDepositAmount', () => {
    it('accepts 1-500 euros', () => {
        expect(parseDepositAmount(20)).toBe(20);
        expect(parseDepositAmount('25.5')).toBe(25.5);
        expect(parseDepositAmount(1)).toBe(1);
        expect(parseDepositAmount(500)).toBe(500);
    });

    it('rejects out-of-range values', () => {
        expect(() => parseDepositAmount(0)).toThrow();
        expect(() => parseDepositAmount(501)).toThrow();
        expect(() => parseDepositAmount(undefined)).toThrow();
    });
});

describe('isStripeEnabled', () => {
    it('reflects the secret key presence', () => {
        const original = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        expect(isStripeEnabled()).toBe(false);
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        expect(isStripeEnabled()).toBe(true);
        if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
        else process.env.STRIPE_SECRET_KEY = original;
    });
});

describe('connectErrorResponse', () => {
    it('maps platform-activation failures to an actionable 400', () => {
        const res = connectErrorResponse(
            new Error('Your account must be activated in order to create accounts.'),
        );
        expect(res.status).toBe(400);
        expect(res.error).toMatch(/not activated/i);
    });

    it('keeps unknown failures as generic 500s', () => {
        const res = connectErrorResponse(new Error('socket hang up'));
        expect(res).toEqual({ status: 500, error: 'Failed to start Stripe onboarding' });
    });
});

describe('stripeMode', () => {
    it('derives test/live/unconfigured from the key prefix', () => {
        const original = process.env.STRIPE_SECRET_KEY;
        process.env.STRIPE_SECRET_KEY = 'rk_test_abc';
        expect(stripeMode()).toBe('test');
        process.env.STRIPE_SECRET_KEY = 'sk_live_abc';
        expect(stripeMode()).toBe('live');
        delete process.env.STRIPE_SECRET_KEY;
        expect(stripeMode()).toBe('unconfigured');
        if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
        else process.env.STRIPE_SECRET_KEY = original;
    });
});
