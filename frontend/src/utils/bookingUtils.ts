import dayjs from 'dayjs';
import { RESTAURANT_TZ } from './dayjs';
import type { Booking } from '../types';
export type AffluenceLevel = 'low' | 'medium' | 'high' | 'critical';

export const calculateAffluence = (bookings: Booking[]) => {
    const counts: Record<string, number> = {};

    bookings.forEach(booking => {
        if (booking.status === 'CANCELLED') return;
        const date = dayjs(booking.startTime).format('YYYY-MM-DD');
        counts[date] = (counts[date] || 0) + 1;
    });

    const modifiers: Record<AffluenceLevel, Date[]> = {
        low: [],
        medium: [],
        high: [],
        critical: []
    };

    Object.entries(counts).forEach(([dateStr, count]) => {
        // Normalize to midnight local time to match react-day-picker behavior
        const date = dayjs(dateStr).startOf('day').toDate();
        if (count <= 5) {
            modifiers.low.push(date);
        } else if (count <= 15) {
            modifiers.medium.push(date);
        } else if (count <= 25) {
            modifiers.high.push(date);
        } else {
            modifiers.critical.push(date);
        }
    });

    return modifiers;
};

export const affluenceClassNames = {
    low: "low",
    medium: "medium",
    high: "high",
    critical: "critical"
};

export const formatTableLabels = (tables: (string | { name: string })[]): string[] => {    if (!tables || tables.length === 0) return [];

    // Normalize and sort table names numerically
    const normalized = tables.map(t => typeof t === 'string' ? t : t.name);

    const sorted = normalized
        .map(name => ({ val: parseInt(name), original: name }))
        .sort((a, b) => {
            if (isNaN(a.val) || isNaN(b.val)) return a.original.localeCompare(b.original);
            return a.val - b.val;
        });

    const results: string[] = [];
    let i = 0;

    while (i < sorted.length) {
        const current = sorted[i];

        // If not a number, just add it and continue
        if (isNaN(current.val)) {
            results.push(current.original);
            i++;
            continue;
        }

        let j = i;
        while (j + 1 < sorted.length && !isNaN(sorted[j + 1].val) && sorted[j + 1].val === sorted[j].val + 1) {
            j++;
        }

        if (j > i) {
            results.push(`${sorted[i].val} to ${sorted[j].val}`);
            i = j + 1;
        } else {
            results.push(current.original);
            i++;
        }
    }

    return results;
};

/**
 * Host command-bar matching: name, phone or assigned table name.
 * Empty query matches everything (used to reset filters).
 */
export const matchesHostQuery = (b: Booking, q: string): boolean => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
        b.name.toLowerCase().includes(s) ||
        (b.phone ?? '').toLowerCase().includes(s) ||
        (b.tables ?? []).some(t => t.name.toLowerCase().includes(s))
    );
};

export type BookingUrgency = 'upcoming' | 'expected' | 'late' | 'seated' | 'done';

/**
 * Live state of a booking for the host view, given the tenant's late
 * tolerance (graceMin): `expected` inside [start − 45 min, start + grace],
 * `late` past grace while still open.
 */
export const bookingUrgency = (b: Booking, now: dayjs.Dayjs, graceMin: number): BookingUrgency => {
    if (b.status === 'COMPLETED') return 'seated';
    if (b.status === 'CANCELLED') return 'done';
    const start = dayjs(b.startTime);
    if (now.isAfter(start.add(graceMin, 'minute'))) return 'late';
    if (now.isAfter(start.subtract(45, 'minute'))) return 'expected';
    return 'upcoming';
};

/** Whole minutes past startTime (0 when early) — shown as « en retard ». */
export const lateMinutes = (b: Booking, now: dayjs.Dayjs): number =>
    Math.max(0, now.diff(dayjs(b.startTime), 'minute'));

/**
 * Badge counter for the Planning tab: open bookings for the day that are
 * unseated or starting within 45 minutes.
 */
export const countArrivalsNow = (bookings: Booking[], date: string, now: dayjs.Dayjs): number =>
    bookings.filter(b => {
        if (dayjs(b.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD') !== date) return false;
        if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return false;
        const unseated = !b.tables || b.tables.length === 0;
        const arriving = dayjs(b.startTime).diff(now, 'minute') <= 45;
        return unseated || arriving;
    }).length;

/** 30-minute slot label in restaurant time, e.g. "19:30". */
export const slotKey = (startTime: string | Date): string => {
    const d = dayjs(startTime).tz(RESTAURANT_TZ);
    return `${d.format('HH')}:${d.minute() < 30 ? '00' : '30'}`;
};

/** Group rows into ascending 30-min slots (pure, unit-tested). */
export const groupBySlot = (list: Booking[]): { slot: string; rows: Booking[] }[] => {
    const map = new Map<string, Booking[]>();
    for (const b of list) {
        const key = slotKey(b.startTime);
        const arr = map.get(key) ?? [];
        arr.push(b);
        map.set(key, arr);
    }
    return [...map.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([slot, rows]) => ({ slot, rows }));
};

/** Staff tag emoji (VIP / allergies / celebration / stroller). */
export const TAG_EMOJI: Record<string, string> = {
    VIP: '🌟',
    ALLERGY: '⚠️',
    BIRTHDAY: '🎂',
    STROLLER: '👶',
};

/** Raw detail behind a tag (null when blank/absent). */
export const tagDetail = (b: Booking, tag: string): string | null => {
    if (tag === 'ALLERGY') return b.allergyNote ?? null;
    if (tag === 'VIP') return b.vipNote ?? null;
    if (tag === 'BIRTHDAY') return b.birthdayDate ?? null;
    return null;
};

/** Whole years since an ISO date at a reference day (null when blank/invalid/future). */
export const ageYears = (isoDate: string | null | undefined, at: dayjs.Dayjs = dayjs()): number | null => {
    if (!isoDate) return null;
    const d = dayjs(isoDate);
    if (!d.isValid() || d.isAfter(at, 'day')) return null;
    let age = at.year() - d.year();
    if (at.month() < d.month() || (at.month() === d.month() && at.date() < d.date())) age -= 1;
    return age;
};

export type SizeBand = 'all' | '2' | '4' | '6p';

/** Rush-friendly party-size bands (no exact typing). */
export const matchesSizeBand = (b: Booking, band: SizeBand): boolean => {
    if (band === 'all') return true;
    if (band === '2') return b.size <= 2;
    if (band === '4') return b.size >= 3 && b.size <= 4;
    return b.size >= 5;
};
