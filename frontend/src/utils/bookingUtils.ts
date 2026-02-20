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
