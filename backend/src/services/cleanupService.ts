import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';
import type { Server } from 'socket.io';

/**
 * Automatically cleans up bookings older than 2 days.
 * Can be configured to delete or archive.
 * Here we delete as requested.
 */
export async function cleanupOldBookings() {
    console.log('🧹 [Cleanup] Starting periodic cleanup of old reservations...');
    try {
        const thresholdDate = dayjs().subtract(2, 'days').toDate();

        const count = await prisma.booking.deleteMany({
            where: {
                startTime: {
                    lt: thresholdDate
                }
            }
        });

        console.log(`✅ [Cleanup] Successfully deleted ${count.count} old reservations.`);
    } catch (error) {
        console.error('❌ [Cleanup] Failed to cleanup old bookings:', error);
    }
}

// Run cleanup every 24 hours
export function startCleanupTask(io?: Server) {
    // Run immediately on start
    cleanupOldBookings();
    void autoCancelNoShows(io);

    // Then every 24 hours
    const interval = 24 * 60 * 60 * 1000;
    setInterval(cleanupOldBookings, interval);

    // No-show sweep frequency only — the no-show delay itself stays
    // tenant-facing (lateGraceMinutes: 15/30/45/60 min from onboarding).
    setInterval(() => void autoCancelNoShows(io), 10 * 60 * 1000);
}

/**
 * No-show sweep: cancels still-open bookings whose startTime is older
 * than the tenant's own late-tolerance window. Opt-in per tenant via
 * `autoCancelLate` (onboarding + settings). Already-seated (COMPLETED)
 * and CANCELLED bookings are never touched.
 *
 * @returns number of bookings auto-cancelled.
 */
export async function autoCancelNoShows(io?: Server): Promise<number> {
    try {
        const policies = await prisma.restaurantSettings.findMany({
            where: { autoCancelLate: true },
            select: { tenantId: true, lateGraceMinutes: true },
        });
        let total = 0;
        for (const policy of policies) {
            const cutoff = dayjs().subtract(policy.lateGraceMinutes, 'minutes').toDate();
            const res = await prisma.booking.updateMany({
                where: {
                    tenantId: policy.tenantId,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    startTime: { lt: cutoff },
                },
                data: { status: 'CANCELLED', cancelledBy: 'AUTO' },
            });
            total += res.count;
        }
        if (total > 0) {
            console.log(`⏰ [NoShow] Auto-cancelled ${total} late booking(s).`);
            io?.emit('booking-update', { type: 'no-show-sweep' });
        }
        return total;
    } catch (error) {
        console.error('❌ [NoShow] sweep failed:', error);
        return 0;
    }
}
