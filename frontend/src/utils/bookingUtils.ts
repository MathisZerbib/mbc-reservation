import dayjs from 'dayjs';
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

export const formatTableLabels = (tables: (string | { name: string })[]): string[] => {
    if (!tables || tables.length === 0) return [];

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
