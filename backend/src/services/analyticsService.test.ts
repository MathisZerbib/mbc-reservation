import { describe, it, expect } from 'vitest';
import { computeAnalytics } from './analyticsService';

const dt = (iso: string) => new Date(iso);

describe('computeAnalytics', () => {
    it('returns exact counts with empty day (no invented numbers)', () => {
        const result = computeAnalytics('2026-09-28', [], 0, 36);

        expect(result.totalBookings).toBe(0);
        expect(result.totalGuests).toBe(0);
        expect(result.turnover).toBe(0);
        expect(result.peakHour).toBe('—');
        expect(result.peakHourGuests).toBe(0);
        expect(result.occupancyRate).toBe(0);
        expect(result.hourlyBreakdown).toEqual([]);
        // No baseline + no bookings: honest dash, not "+12%" or "+100%".
        expect(result.growth).toBe('—');
        expect(result.growthPct).toBe(0);
    });

    it('buckets arrivals per hour and picks the hour with most guests', () => {
        const result = computeAnalytics(
            '2026-09-28',
            [
                { size: 2, startTime: dt('2026-09-28T19:10:00+02:00'), endTime: dt('2026-09-28T21:10:00+02:00'), tables: [{ id: 1 }] },
                { size: 4, startTime: dt('2026-09-28T19:40:00+02:00'), endTime: dt('2026-09-28T21:40:00+02:00'), tables: [{ id: 2 }] },
                { size: 3, startTime: dt('2026-09-28T20:05:00+02:00'), endTime: dt('2026-09-28T22:05:00+02:00'), tables: [{ id: 3 }] },
            ],
            2,
            36,
            55,
        );

        expect(result.totalBookings).toBe(3);
        expect(result.totalGuests).toBe(9);
        expect(result.turnover).toBe(495);
        expect(result.avgTicket).toBe(55);
        expect(result.peakHour).toBe('19:00');
        expect(result.peakHourGuests).toBe(6);
        expect(result.tablesUsed).toBe(3);
        expect(result.occupancyRate).toBeCloseTo(8.3, 1);
        // Growth vs previous day: (3-2)/2 = +50%.
        expect(result.growthPct).toBe(50);
        expect(result.growth).toBe('+50.0%');

        expect(result.hourlyBreakdown).toHaveLength(2);
        const sevenPm = result.hourlyBreakdown[0];
        expect(sevenPm.hour).toBe('19:00');
        expect(sevenPm.bookings).toBe(2);
        expect(sevenPm.guests).toBe(6);
        expect(sevenPm.bookingsPct).toBeCloseTo(66.7, 1);
        expect(sevenPm.guestsPct).toBeCloseTo(66.7, 1);
    });

    it('returns null growth when there is no baseline instead of inventing one', () => {
        const result = computeAnalytics(
            '2026-09-28',
            [{ size: 2, startTime: dt('2026-09-28T19:00:00+02:00'), endTime: dt('2026-09-28T21:00:00+02:00'), tables: [] }],
            0,
            36,
        );

        expect(result.growthPct).toBeNull();
        expect(result.growth).toBe('—');
    });
});
