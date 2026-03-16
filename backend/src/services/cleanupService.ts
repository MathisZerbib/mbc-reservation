import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';

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
export function startCleanupTask() {
    // Run immediately on start
    cleanupOldBookings();
    
    // Then every 24 hours
    const interval = 24 * 60 * 60 * 1000;
    setInterval(cleanupOldBookings, interval);
}
