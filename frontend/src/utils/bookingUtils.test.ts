import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { slotKey, groupBySlot, matchesSizeBand, ageYears } from './bookingUtils';
import type { Booking } from '../types';

const booking = (over: Partial<Booking> & { startTime: string }): Booking => ({
    id: Math.random().toString(),
    name: 'Test',
    size: 2,
    endTime: over.startTime,
    lowTable: false,
    status: 'CONFIRMED',
    tables: [],
    ...over,
});

describe('slotKey', () => {
    // 2026-09-30 is CEST (UTC+2): 17:00Z wall-clocks as 19:00 in Paris.
    it('buckets into 30-min slots', () => {
        expect(slotKey('2026-09-30T17:00:00Z')).toBe('19:00');
        expect(slotKey('2026-09-30T17:29:00Z')).toBe('19:00');
        expect(slotKey('2026-09-30T17:30:00Z')).toBe('19:30');
        expect(slotKey('2026-09-30T17:59:00Z')).toBe('19:30');
    });
});

describe('groupBySlot', () => {
    it('groups and sorts ascending', () => {
        const rows = groupBySlot([
            booking({ startTime: '2026-09-30T18:00:00Z' }),
            booking({ startTime: '2026-09-30T17:10:00Z' }),
            booking({ startTime: '2026-09-30T17:40:00Z' }),
        ]);
        expect(rows.map(g => g.slot)).toEqual(['19:00', '19:30', '20:00']);
        expect(rows[0].rows).toHaveLength(1);
    });

    it('returns empty for no bookings', () => {
        expect(groupBySlot([])).toEqual([]);
    });
});

describe('matchesSizeBand', () => {    it('matches rush bands', () => {
        const b2 = booking({ startTime: '2026-09-30T19:00:00', size: 2 });
        const b4 = booking({ startTime: '2026-09-30T19:00:00', size: 4 });
        const b8 = booking({ startTime: '2026-09-30T19:00:00', size: 8 });
        expect(matchesSizeBand(b2, 'all')).toBe(true);
        expect(matchesSizeBand(b2, '2')).toBe(true);
        expect(matchesSizeBand(b4, '2')).toBe(false);
        expect(matchesSizeBand(b4, '4')).toBe(true);
        expect(matchesSizeBand(b8, '4')).toBe(false);
        expect(matchesSizeBand(b8, '6p')).toBe(true);
        expect(matchesSizeBand(b2, '6p')).toBe(false);
    });
});

describe('ageYears', () => {
    it('computes whole years at a reference day', () => {
        const at = dayjs('2026-09-30T12:00:00Z');
        expect(ageYears('2014-03-15', at)).toBe(12);
        expect(ageYears('2026-09-30', at)).toBe(0);
        expect(ageYears(null, at)).toBeNull();
        expect(ageYears('', at)).toBeNull();
        expect(ageYears('not-a-date', at)).toBeNull();
        expect(ageYears('2027-01-01', at)).toBeNull();
    });
});
