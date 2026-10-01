import { prisma } from '../lib/prisma';
import { sandboxSlugs } from './tenantService';
import { emitToTenant } from '../lib/tenantSocket';
import dayjs from 'dayjs';
import type { Server } from 'socket.io';

/**
 * GDPR retention: anonymizes PII of bookings older than the tenant's
 * retention window (default 13 months) instead of deleting them, so
 * analytics history survives. Sandbox tenants are excluded entirely.
 * Aggregate facts (size, times, status, tables) are kept for stats.
 */
export async function cleanupOldBookings() {
    console.log('🧹 [Cleanup] Starting PII retention pass...');
    try {
        const policies = await prisma.restaurantSettings.findMany({
            select: { tenantId: true, retentionMonths: true, tenant: { select: { slug: true } } },
        });
        const sandboxes = sandboxSlugs();
        let total = 0;
        for (const policy of policies) {
            if (sandboxes.has(policy.tenant.slug.toLowerCase())) continue;
            const months = Number.isInteger(policy.retentionMonths) && policy.retentionMonths > 0
                ? policy.retentionMonths
                : 13;
            const threshold = dayjs().subtract(months, 'months').toDate();
            const res = await prisma.booking.updateMany({
                where: {
                    tenantId: policy.tenantId,
                    deletedAt: null,
                    startTime: { lt: threshold },
                    NOT: { name: '—' },
                },
                data: {
                    name: '—',
                    phone: null,
                    email: null,
                    tags: [],
                    allergyNote: null,
                    birthdayDate: null,
                    vipNote: null,
                    guestConfirmed: false,
                },
            });
            total += res.count;
        }
        console.log(`✅ [Cleanup] Anonymized PII of ${total} old reservation(s).`);
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
        // Demo/sandbox tenants are frozen snapshots: the sweep would rot
        // their future bookings into no-shows day after day.
        const policies = await prisma.restaurantSettings.findMany({
            where: { autoCancelLate: true, tenant: { slug: { notIn: [...sandboxSlugs()] } } },
            select: { tenantId: true, lateGraceMinutes: true },
        });
        let total = 0;
        for (const policy of policies) {
            const cutoff = dayjs().subtract(policy.lateGraceMinutes, 'minutes').toDate();
            const res = await prisma.booking.updateMany({
                where: {
                    tenantId: policy.tenantId,
                    deletedAt: null,
                    status: { in: ['PENDING', 'CONFIRMED'] },
                    startTime: { lt: cutoff },
                },
                data: { status: 'CANCELLED', cancelledBy: 'AUTO' },
            });
            total += res.count;
            // Tenant-scoped: only this restaurant's screens refresh.
            if (io && res.count > 0) emitToTenant(io, policy.tenantId, 'booking-update', { type: 'no-show-sweep' });
        }
        if (total > 0) {
            console.log(`⏰ [NoShow] Auto-cancelled ${total} late booking(s).`);
        }
        return total;
    } catch (error) {
        console.error('❌ [NoShow] sweep failed:', error);
        return 0;
    }
}
