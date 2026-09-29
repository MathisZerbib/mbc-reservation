import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { prisma } from '../lib/prisma';
import { getAvgTicket, DEFAULT_AVG_TICKET } from './settingsService';

dayjs.extend(utc);
dayjs.extend(timezone);

export const RESTAURANT_TZ = 'Europe/Paris';

export interface HourlySlice {
    /** Hour bucket label in restaurant timezone, e.g. "19:00". */
    hour: string;
    /** Bookings whose startTime falls in this hour. */
    bookings: number;
    /** Guests (sum of size) arriving in this hour. */
    guests: number;
    /** Share of the day's bookings in this hour (0-100, 1 decimal). */
    bookingsPct: number;
    /** Share of the day's guests in this hour (0-100, 1 decimal). */
    guestsPct: number;
}

export interface DailyAnalytics {
    date: string;
    totalBookings: number;
    totalGuests: number;
    avgPartySize: number;
    /** Estimated turnover = totalGuests × avgTicket (no POS data in schema). */
    turnover: number;
    avgTicket: number;
    /** Arrival hour ("HH:00") with the most guests, or "—" when empty. */
    peakHour: string;
    /** Guests arriving during the peak hour. */
    peakHourGuests: number;
    /** Distinct tables used / total tables (0-100, 1 decimal). */
    occupancyRate: number;
    tablesUsed: number;
    totalTables: number;
    /** Day-over-day bookings change vs previous day, formatted ("+12.5%" / "—"). */
    growth: string;
    growthPct: number | null;
    /** Per-hour arrival distribution; shares sum to ~100. */
    hourlyBreakdown: HourlySlice[];
}

type BookingSlice = {
    size: number;
    startTime: Date;
    endTime: Date;
    tables?: { id: number }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const formatGrowth = (pct: number | null): string => {
    if (pct === null || !Number.isFinite(pct)) return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
};

/**
 * Pure aggregation over already-fetched bookings.
 * Kept separate from the DB query so it is unit-testable without Prisma.
 */
export function computeAnalytics(
    date: string,
    today: BookingSlice[],
    previousDayBookingCount: number,
    totalTables: number,
    avgTicket: number = DEFAULT_AVG_TICKET,
): DailyAnalytics {
    const totalBookings = today.length;
    const totalGuests = today.reduce((sum, b) => sum + b.size, 0);
    const avgPartySize = totalBookings === 0 ? 0 : round1(totalGuests / totalBookings);
    const turnover = totalGuests * avgTicket;

    // ── Hourly arrival buckets (restaurant timezone) ──
    const byHour = new Map<string, { bookings: number; guests: number }>();
    for (const b of today) {
        const hour = `${dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH')}:00`;
        const entry = byHour.get(hour) ?? { bookings: 0, guests: 0 };
        entry.bookings += 1;
        entry.guests += b.size;
        byHour.set(hour, entry);
    }

    let peakHour = '—';
    let peakHourGuests = 0;
    const hourlyBreakdown: HourlySlice[] = [...byHour.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([hour, { bookings, guests }]) => {
            // Earliest hour wins ties (sorted order + strict >).
            if (guests > peakHourGuests) {
                peakHour = hour;
                peakHourGuests = guests;
            }
            return {
                hour,
                bookings,
                guests,
                bookingsPct: totalBookings === 0 ? 0 : round1((bookings / totalBookings) * 100),
                guestsPct: totalGuests === 0 ? 0 : round1((guests / totalGuests) * 100),
            };
        });

    // ── Occupancy: distinct tables touched today ──
    const usedTableIds = new Set<number>();
    for (const b of today) {
        for (const t of b.tables ?? []) usedTableIds.add(t.id);
    }
    const tablesUsed = usedTableIds.size;
    const occupancyRate = totalTables === 0 ? 0 : round1((tablesUsed / totalTables) * 100);

    // ── Day-over-day growth (exact, from DB — never hardcoded) ──
    const growthPct =
        previousDayBookingCount === 0
            ? totalBookings > 0
                ? null // no baseline: honest "—" instead of inventing +100%
                : 0
            : round1(((totalBookings - previousDayBookingCount) / previousDayBookingCount) * 100);

    return {
        date,
        totalBookings,
        totalGuests,
        avgPartySize,
        turnover,
        avgTicket,
        peakHour,
        peakHourGuests,
        occupancyRate,
        tablesUsed,
        totalTables,
        // No baseline (0 yesterday): "—" even when both days are empty —
        // formatGrowth(0) would print a misleading "0.0%".
        growth: previousDayBookingCount === 0 ? '—' : formatGrowth(growthPct),
        growthPct,
        hourlyBreakdown,
    };
}

/**
 * Exact daily analytics computed from the database.
 *
 * Optimized: 3 queries in parallel, minimal selects, single pass over rows.
 * - today's active bookings (size, times, table ids)
 * - previous day's active booking count (growth baseline)
 * - total table count (occupancy baseline)
 */
export async function getDailyAnalytics(dateStr: string, tenantId: string): Promise<DailyAnalytics> {
    const parsed = dayjs.tz(dateStr, 'YYYY-MM-DD', RESTAURANT_TZ);
    if (!parsed.isValid()) throw new Error('Invalid date, expected YYYY-MM-DD');

    const startOfDay = parsed.startOf('day').toDate();
    const endOfDay = parsed.endOf('day').toDate();
    const prevStart = parsed.subtract(1, 'day').startOf('day').toDate();
    const prevEnd = parsed.subtract(1, 'day').endOf('day').toDate();

    const [today, previousDayBookingCount, totalTables, avgTicket] = await Promise.all([
        prisma.booking.findMany({
            where: {
                tenantId,
                startTime: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' },
            },
            select: {
                size: true,
                startTime: true,
                endTime: true,
                tables: { select: { id: true } },
            },
        }),
        prisma.booking.count({
            where: {
                tenantId,
                startTime: { gte: prevStart, lte: prevEnd },
                status: { not: 'CANCELLED' },
            },
        }),
        prisma.table.count({ where: { tenantId } }),
        getAvgTicket(tenantId),
    ]);

    return computeAnalytics(dateStr, today, previousDayBookingCount, totalTables, avgTicket);
}
