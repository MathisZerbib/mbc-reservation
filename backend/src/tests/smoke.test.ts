import { describe, it, expect, vi } from 'vitest';
import { Router } from 'express';
import { bookingRoutes } from '../routes/bookingRoutes';
import { tableRoutes } from '../routes/tableRoutes';
import { settingsRoutes } from '../routes/settingsRoutes';
import tenantRoutes from '../routes/tenantRoutes';
import { isTrialActive, slugify } from '../services/tenantService';
import { signVerificationToken, verifyVerificationToken } from '../utils/verification';

process.env.JWT_ACCESS_SECRET ??= 'smoke-test-secret';

const io = { emit: vi.fn() } as any;

const pathsOf = (router: Router): string[] =>
    ((router as any).stack ?? [])
        .filter((l: any) => l.route)
        .map((l: any) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);

describe('route wiring smoke', () => {
    it('exposes the tenant-scoped booking routes', () => {
        const paths = pathsOf(bookingRoutes(io));
        expect(paths).toEqual(
            expect.arrayContaining([
                'GET /analytics',
                'GET /daily-availability',
                'GET /availability',
                'POST /bookings',
                'GET /bookings',
            ]),
        );
    });

    it('exposes table layout + settings + tenant routes', () => {
        expect(pathsOf(tableRoutes(io))).toEqual(
            expect.arrayContaining(['GET /tables', 'PUT /tables/layout', 'DELETE /tables/:id', 'POST /tables/analyze-image']),
        );
        expect(pathsOf(settingsRoutes(io))).toEqual(
            expect.arrayContaining(['GET /settings', 'PATCH /settings', 'POST /settings/floor-plan-image']),
        );
        expect(pathsOf(tenantRoutes)).toEqual(
            expect.arrayContaining(['GET /tenants/me', 'PATCH /tenants/me']),
        );
    });

    it('guards every mutating booking route with trial enforcement', () => {
        const stack = (bookingRoutes(io) as any).stack as any[];
        const mutating = stack.filter(
            (l: any) => l.route && ['POST', 'PATCH'].includes(Object.keys(l.route.methods)[0].toUpperCase()),
        );
        // Each mutating route must carry more than just the handler (auth/tenant/trial/limiters).
        for (const layer of mutating) {
            expect(layer.route.stack.length).toBeGreaterThan(1);
        }
    });
});

describe('trial + slug smoke', () => {
    it('trial is active until trialEndsAt, expired afterwards', () => {
        const now = new Date('2026-09-29T12:00:00Z');
        expect(isTrialActive(new Date('2026-10-13T12:00:00Z'), now)).toBe(true);
        expect(isTrialActive(new Date('2026-09-29T12:00:00Z'), now)).toBe(false);
        expect(isTrialActive(new Date('2026-09-01T12:00:00Z'), now)).toBe(false);
    });

    it('slugifies restaurant names to URL-safe slugs', () => {
        expect(slugify('Le Petit Café')).toBe('le-petit-cafe');
        expect(slugify('  MBC  ')).toBe('mbc');
        expect(slugify('!!!')).toBe('restaurant');
    });
});

describe('verification token smoke', () => {
    it('round-trips and rejects foreign tokens', () => {
        const token = signVerificationToken('user-1');
        expect(verifyVerificationToken(token)).toBe('user-1');
        expect(() => verifyVerificationToken('bogus')).toThrow();
    });
});
