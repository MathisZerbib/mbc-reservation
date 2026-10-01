import { describe, it, expect } from 'vitest';

import {
    computeRangeAnalytics,
    guestKey,
    isWalkin,
} from './rangeAnalyticsService';
import { ticketForService } from './settingsService';

const row = (over: Record<string, unknown> = {}) => ({
    size: 2,
    startTime: new Date('2026-09-20T19:00:00+02:00'),
    endTime: new Date('2026-09-20T21:00:00+02:00'),
    createdAt: new Date('2026-09-18T10:00:00+02:00'),
    status: 'CONFIRMED',
    cancelledBy: null,
    source: 'RESERVATION',
    name: 'Dupont',
    phone: '+33611223344',
    email: null,
    seatedAt: null,
    leftAt: null,
    ...over,
});

describe('guestKey', () => {
    it('prefers phone digits, then email, then name', () => {
        expect(guestKey({ name: 'X', phone: '+33 6 11 22 33 44', email: 'a@b.c' })).toBe('p:33611223344');
        expect(guestKey({ name: 'X', phone: null, email: 'A@B.c ' })).toBe('e:a@b.c');
        expect(guestKey({ name: '  Dupont ', phone: null, email: null })).toBe('n:dupont');
    });
});

describe('isWalkin', () => {
    it('trusts explicit source, else <2h lead heuristic', () => {
        expect(isWalkin(row({ source: 'WALKIN' }))).toEqual({ walkin: true, estimated: false });
        expect(
            isWalkin(row({ source: 'RESERVATION', createdAt: new Date('2026-09-20T18:00:00+02:00') })),
        ).toEqual({ walkin: true, estimated: true });
        expect(isWalkin(row())).toEqual({ walkin: false, estimated: false });
    });
});

describe('ticketForService', () => {
    it('picks lunch before 15h, dinner after, fallback to global', () => {
        const lunch = new Date('2026-09-20T12:30:00+02:00');
        const dinner = new Date('2026-09-20T20:00:00+02:00');
        expect(ticketForService(lunch, 55, 22, 45)).toBe(22);
        expect(ticketForService(dinner, 55, 22, 45)).toBe(45);
        expect(ticketForService(lunch, 55, null, null)).toBe(55);
        expect(ticketForService(dinner, 55, null, 45)).toBe(45);
    });
});

describe('computeRangeAnalytics', () => {
    it('aggregates totals, rates, bands, heatmap, turnover and CRM', () => {
        const rows = [
            row({ name: 'Alice', phone: '+33600000001', size: 2 }),
            row({
                name: 'Bob', phone: '+33600000002', size: 5,
                startTime: new Date('2026-09-20T12:30:00+02:00'),
                endTime: new Date('2026-09-20T14:00:00+02:00'),
                seatedAt: new Date('2026-09-20T12:35:00+02:00'),
                leftAt: new Date('2026-09-20T14:05:00+02:00'),
            }),
            row({ name: 'Ghost', phone: '+33600000003', status: 'CANCELLED', cancelledBy: 'AUTO' }),
            row({ name: 'Late', phone: '+33600000004', status: 'CANCELLED', cancelledBy: 'HOST' }),
        ];
        const res = computeRangeAnalytics('2026-09-20', '2026-09-20', rows, new Set(['p:33600000001']), 55, 22, 45);

        expect(res.totals.bookings).toBe(2);
        expect(res.totals.guests).toBe(7);
        // Alice dinner 2×45 + Bob lunch 5×22
        expect(res.totals.turnover).toBe(200);
        expect(res.totals.noShows).toBe(1);
        expect(res.totals.cancellations).toBe(2);
        expect(res.totals.noShowRate).toBe(25);
        expect(res.totals.cancelRate).toBe(50);
        expect(res.sizeBands).toEqual([
            { label: '2', bookings: 1, guests: 2 },
            { label: '4', bookings: 0, guests: 0 },
            { label: '6+', bookings: 1, guests: 5 },
        ]);
        // Real turnover: Bob 12:35 → 14:05 = 90 min
        expect(res.turnover.avgMinutes).toBe(90);
        expect(res.turnover.realShare).toBe(100);
        // CRM: Alice known before, Bob + Ghost new (host-cancelled Late leaves no trace)
        expect(res.crm.newClients).toBe(2);
        expect(res.crm.returningClients).toBe(1);
        expect(res.crm.top[0].name).toBe('Alice');
        const ghost = res.crm.top.find(c => c.name === 'Ghost');
        expect(ghost?.noShows).toBe(1);
        expect(ghost?.visits).toBe(0);
        expect(res.heatmap.length).toBe(2);
        expect(res.days).toHaveLength(1);
    });

    it('returns zeros on empty input', () => {
        const res = computeRangeAnalytics('2026-09-20', '2026-09-20', [], new Set(), 55, null, null);
        expect(res.totals.bookings).toBe(0);
        expect(res.totals.noShowRate).toBe(0);
        expect(res.turnover.avgMinutes).toBe(0);
        expect(res.crm.top).toEqual([]);
    });
});
