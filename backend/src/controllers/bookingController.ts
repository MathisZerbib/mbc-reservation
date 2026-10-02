import { Response } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';
import { getAvailableTables, findTableCombination, addMinutes, RESERVATION_DURATION, getSuggestions, createReservation, rescheduleBooking, MIN_BOOKING_ADVANCE_HOURS } from '../services/bookingService';
import { getAdjacencyMap } from '../services/floorPlanService';
import { getDailyAnalytics } from '../services/analyticsService';
import { getRangeAnalytics } from '../services/rangeAnalyticsService';
import { verifyTurnstile } from '../utils/turnstile';
import { getSettings, resolveOpenSlots } from '../services/settingsService';
import { isStripeEnabled, depositRequired, createDepositHold } from '../services/depositService';
import { captureNoShow, releaseHold, getUnresolvedHolds } from '../services/stripeConnectService';
import { Server } from 'socket.io';
import { emitToTenant } from '../lib/tenantSocket';
import { emailService } from '../services/emailService';
import { Booking } from '../types/booking';
import { AuthRequest } from '../middleware/isAuthenticated';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = 'Europe/Paris';

const getIsAdmin = (req: AuthRequest) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader) return false;
    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_ACCESS_SECRET as string);
        return true;
    } catch (e) {
        return false;
    }
};

/** Tenant id guaranteed by requireTenant / resolveTenantFromSlug middleware. */
const tenantId = (req: AuthRequest): string => req.tenant!.id;




export const bookingController = (io: Server) => ({
    checkAvailability: async (req: AuthRequest, res: Response) => {
        try {
            const { date, time, size } = req.query;
            if (!date || !time || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            const tid = tenantId(req);
            // Parse requested time specifically in the restaurant's timezone
            const requestedStart = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ);
            if (isNaN(requestedStart.toDate().getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            // Outside opening hours → unavailable (staff bypass for walk-ins).
            if (!getIsAdmin(req)) {
                const open = resolveOpenSlots(date as string, (await getSettings(tid)).openHours ?? null);
                if (!open.includes(time as string)) {
                    const suggestions = await getSuggestions(date as string, guestSize, time as string, tid);
                    return res.json({ available: false, tables: [], suggestions, closed: open.length === 0 });
                }
            }

            // 2h buffer check (admin bypass)
            if (!getIsAdmin(req) && requestedStart.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) {
                const suggestions = await getSuggestions(date as string, guestSize, time as string, tid);
                return res.json({
                    available: false,
                    tables: [],
                    suggestions
                });
            }

            const requestedEnd = addMinutes(requestedStart.toDate(), RESERVATION_DURATION);

            const available = await getAvailableTables(requestedStart.toDate(), requestedEnd, tid);
            const combination = findTableCombination(guestSize, available, await getAdjacencyMap(tid));

            let suggestions: string[] = [];
            if (!combination) {
                suggestions = await getSuggestions(date as string, guestSize, time as string, tid);
            }

            res.json({
                available: !!combination,
                tables: combination || [],
                suggestions
            });
        } catch (e) {
            console.error('Availability error:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * Public opening-hours for a date (powers the booking widget grid).
     * Returns ONLY hours — never tickets, deposits, or other settings.
     */
    getOpenHours: async (req: AuthRequest, res: Response) => {
        try {
            const { date } = req.query;
            if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return res.status(400).json({ error: 'Missing date (YYYY-MM-DD)' });
            }
            const slots = resolveOpenSlots(date, (await getSettings(tenantId(req))).openHours ?? null);
            res.json({ date, open: slots.length > 0, slots });
        } catch {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getDailyAvailability: async (req: AuthRequest, res: Response) => {
        try {
            const { date, size } = req.query;
            if (!date || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            // Grid comes from the restaurant's opening schedule (closed → []).
            // Staff keep the full legacy grid so walk-ins can sit anywhere.
            const openHours = getIsAdmin(req) ? null : (await getSettings(tenantId(req))).openHours ?? null;
            const TIME_SLOTS = resolveOpenSlots(date as string, openHours);

            const isAdmin = getIsAdmin(req);
            const tid = tenantId(req);
            const adjacency = await getAdjacencyMap(tid);
            const results = await Promise.all(TIME_SLOTS.map(async (time) => {
                const start = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ);

                // 2h buffer check (admin bypass)
                if (!isAdmin && start.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) {
                    return { time, available: false };
                }

                const end = addMinutes(start.toDate(), RESERVATION_DURATION);
                const available = await getAvailableTables(start.toDate(), end, tid);
                const combination = findTableCombination(guestSize, available, adjacency);
                return {
                    time,
                    available: !!combination
                };
            }));

            res.json(results);
        } catch (e) {
            console.error('Daily availability error:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createBooking: async (req: AuthRequest, res: Response) => {
        try {
            let { name, phone, email, size, startTime, language, lowTable, notify, turnstileToken, tags, allergyNote, birthdayDate, vipNote, source } = req.body;

            // Bot protection for anonymous bookings; signed-in staff bypass it.
            if (!getIsAdmin(req)) {
                const human = await verifyTurnstile({ token: turnstileToken, remoteIp: req.ip, expectedAction: 'booking' });
                if (!human) return res.status(400).json({ error: 'Bot verification failed. Please try again.' });
            }

            // 1. Mandatory Fields Guard
            const missingFields: string[] = [];
            if (!name) missingFields.push('name');
            if (!size) missingFields.push('size');
            if (!startTime) missingFields.push('startTime');
            if (missingFields.length > 0) {
                return res.status(400).json({ error: 'Missing fields', missingFields });
            }

            // 2. Strict Sanitization & Security Guards
            name = String(name).trim().substring(0, 20);
            phone = phone ? String(phone).trim().substring(0, 20) : null;
            email = email ? String(email).trim().toLowerCase().substring(0, 24) : null;

            // 3. Validation Rules
            if (name.length < 2) {
                return res.status(400).json({ error: 'Name too short (min 2 characters)' });
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            if (phone && !/^\+?[\d\s-]{8,}$/.test(phone)) {
                return res.status(400).json({ error: 'Invalid phone format' });
            }

            const guestSize = parseInt(size);
            if (isNaN(guestSize) || guestSize < 1 || guestSize > 100) {
                return res.status(400).json({ error: 'Invalid guest size' });
            }

            console.log(`📩 [createBooking] Received request: ${name}, size: ${size}, startTime: ${startTime}`);
            const requestedStart = dayjs.tz(startTime, RESTAURANT_TZ);

            if (isNaN(requestedStart.toDate().getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            // 2h buffer check (admin bypass)
            if (!getIsAdmin(req) && requestedStart.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) {
                return res.status(400).json({ error: `Les réservations doivent être faites au moins ${MIN_BOOKING_ADVANCE_HOURS}h à l'avance.` });
            }

            // Opening-hours guard (staff bypass for walk-ins / phone).
            if (!getIsAdmin(req)) {
                const dayStr = requestedStart.tz(RESTAURANT_TZ).format('YYYY-MM-DD');
                const slot = requestedStart.tz(RESTAURANT_TZ).format('HH:mm');
                const open = resolveOpenSlots(dayStr, (await getSettings(tenantId(req))).openHours ?? null);
                if (!open.includes(slot)) {
                    return res.status(400).json({
                        error: open.length === 0 ? 'Closed that day. Please pick another date.' : 'Outside opening hours.',
                        closed: open.length === 0,
                    });
                }
            }

            // 4. Atomic Execution
            const newBooking = await createReservation({
                name,
                phone,
                email,
                language: language || 'fr',
                size: guestSize,
                startTime: requestedStart.toDate(),
                lowTable: lowTable || false,
                tags,
                allergyNote,
                birthdayDate,
                vipNote,
                // Only staff can file a booking as walk-in; public form stays RESERVATION.
                source: getIsAdmin(req) && source === 'WALKIN' ? 'WALKIN' : 'RESERVATION',
                tenantId: tenantId(req)
            });

            // Send confirmation email
            if (newBooking.email && notify !== false) {
                emailService.sendConfirmationEmail(newBooking);
            }

            // Deposit hold for large public parties (Stripe Checkout, manual
            // capture). Booking stands even if the hold fails — host sees FAILED.
            let depositUrl: string | null = null;
            if (!getIsAdmin(req) && isStripeEnabled()) {
                try {
                    const settings = await getSettings(tenantId(req));
                    if (depositRequired(settings.depositEnabled, settings.depositMinSize, guestSize)) {
                        const base = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/${req.tenant!.slug}`;
                        const hold = await createDepositHold(
                            (newBooking as any).id,
                            tenantId(req),
                            Math.round(settings.depositAmount * 100),
                            {
                                successUrl: `${base}?deposit=held&booking=${(newBooking as any).id}`,
                                cancelUrl: `${base}?deposit=open&booking=${(newBooking as any).id}`,
                            },
                            // Direct charge on the restaurant's Connect account
                            // when onboarded, platform account otherwise.
                            { stripeAccountId: settings.stripeAccountId, stripeOnboarded: settings.stripeOnboarded },
                        );
                        depositUrl = hold.url;
                    }
                } catch (e) {
                    console.error('Deposit hold failed (booking kept):', (e as Error).message);
                    await prisma.booking.update({
                        where: { id: (newBooking as any).id },
                        data: { depositStatus: 'FAILED' } as any,
                    });
                }
            }

            emitToTenant(io, tenantId(req), 'booking-update', { type: 'new', booking: newBooking });
            res.json({ ...newBooking, depositUrl });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    checkIn: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any);
            if (!existing) return res.status(404).json({ error: 'Booking not found' });

            const updatedBooking = await prisma.booking.update({
                where: { id: id },
                data: { status: 'COMPLETED', seatedAt: new Date() }
            } as any);

            // Guest showed up → release the hold (HELD → RELEASED, best-effort).
            try {
                const settings = await getSettings(tid);
                await releaseHold(existing as any, {
                    stripeAccountId: settings.stripeAccountId,
                    stripeOnboarded: settings.stripeOnboarded,
                });
            } catch (e) {
                console.error('Deposit release on check-in failed:', (e as Error).message);
            }

            // Send feedback email after visit
            if (updatedBooking.email) {
                emailService.sendFeedbackEmail(updatedBooking);
            }

            const completeBookingRaw = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });

            // Ensure language is always a string
            const completeBooking: Booking | null = completeBookingRaw
                ? { ...completeBookingRaw, language: completeBookingRaw.language ?? 'fr' }
                : null;

            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to check-in' });
        }
    },

    finishMeal: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any) as any;
            if (!existing) return res.status(404).json({ error: 'Booking not found' });
            if (existing.status !== 'COMPLETED' || !existing.seatedAt) {
                return res.status(400).json({ error: 'Only seated bookings can be finished' });
            }

            const finished = existing.leftAt
                ? existing
                : await prisma.booking.update({
                    where: { id: id },
                    data: { leftAt: new Date() }
                } as any);

            const withTables = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });
            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: withTables ?? finished });
            res.json(withTables ?? finished);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to finish meal' });
        }
    },

    cancelBooking: async (req: AuthRequest, res: Response) => {        try {            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any);
            if (!existing) return res.status(404).json({ error: 'Booking not found' });

            await prisma.booking.update({
                where: { id: id },
                data: { status: 'CANCELLED', cancelledBy: 'HOST' }
            } as any);

            // Timely cancel → release any deposit hold (HELD → RELEASED, best-effort).
            try {
                const settings = await getSettings(tid);
                await releaseHold(existing as any, {
                    stripeAccountId: settings.stripeAccountId,
                    stripeOnboarded: settings.stripeOnboarded,
                });
            } catch (e) {
                console.error('Deposit release on cancel failed:', (e as Error).message);
            }

            const completeBooking = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });

            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to cancel booking' });
        }
    },

    /**
     * POST /bookings/:id/no-show — explicit "Mark No-Show & Charge".
     * THE ONLY capture trigger in the system (fail-safe: no cron, no timeout
     * ever captures). Requires a HELD hold; anything else → 409.
     */
    markNoShowAndCharge: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any) as any;
            if (!existing) return res.status(404).json({ error: 'Booking not found' });
            if (existing.depositStatus !== 'HELD' || !existing.stripePaymentIntentId) {
                return res.status(409).json({
                    error: 'No capturable hold on this booking',
                    depositStatus: existing.depositStatus ?? 'NONE',
                });
            }
            try {
                const settings = await getSettings(tid);
                const outcome = await captureNoShow(existing, {
                    stripeAccountId: settings.stripeAccountId,
                    stripeOnboarded: settings.stripeOnboarded,
                });
                if (outcome === 'NOOP') {
                    return res.status(409).json({ error: 'Hold is no longer capturable' });
                }
            } catch (e) {
                console.error('No-show capture failed:', (e as Error).message);
                return res.status(502).json({ error: 'Stripe capture failed — hold left untouched' });
            }
            await prisma.booking.update({
                where: { id: id },
                data: { status: 'CANCELLED', cancelledBy: 'AUTO' }
            } as any);
            const completeBooking = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });
            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to charge no-show' });
        }
    },

    /**
     * GET /bookings/reconciliation — "End of Shift Reconciliation".
     * All bookings from the last 24h still HELD (unresolved): the manager
     * releases (guest came) or captures (true no-show) before Stripe's
     * ~7-day window expires them automatically.
     */
    getReconciliationHolds: async (req: AuthRequest, res: Response) => {
        try {
            res.json(await getUnresolvedHolds(tenantId(req)));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to load reconciliation holds' });
        }
    },

    /**
     * GDPR Art.17: soft-deletes a booking and wipes its PII immediately.
     * Aggregate facts stay for stats; the row vanishes from every query.
     */
    eraseBooking: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any);
            if (!existing) return res.status(404).json({ error: 'Booking not found' });

            await prisma.booking.update({
                where: { id: id },
                data: {
                    deletedAt: new Date(),
                    name: '—',
                    phone: null,
                    email: null,
                    tags: [],
                    allergyNote: null,
                    birthdayDate: null,
                    vipNote: null,
                    guestConfirmed: false,
                }
            } as any);
            emitToTenant(io, tenantId(req), 'booking-update', { type: 'delete', bookingId: id });
            res.json({ erased: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to erase booking' });
        }
    },

    /**
     * GET /bookings[?date=YYYY-MM-DD] — tenant-scoped list.
     * With `date`, only that restaurant-day is returned (host planning/live
     * load a single service at a time instead of the whole history).
     */
    getAllBookings: async (req: AuthRequest, res: Response) => {
        try {
            const { date } = req.query;
            const where: Record<string, unknown> = { tenantId: tenantId(req), deletedAt: null };

            if (date !== undefined) {
                if (typeof date !== 'string') {
                    return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD' });
                }
                const parsed = dayjs.tz(date, 'YYYY-MM-DD', RESTAURANT_TZ);
                if (!parsed.isValid()) {
                    return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD' });
                }
                where.startTime = { gte: parsed.startOf('day').toDate(), lte: parsed.endOf('day').toDate() };
            }

            const bookings = await prisma.booking.findMany({
                where: where as any,
                include: { tables: true } as any
            });
            res.json(bookings);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * GET /bookings/affluence?month=YYYY-MM — per-day booking counts.
     * Powers the agenda calendar's affluence dots without shipping rows.
     */
    getAffluence: async (req: AuthRequest, res: Response) => {
        try {
            const { month } = req.query;
            if (!month || typeof month !== 'string') {
                return res.status(400).json({ error: 'Missing month (YYYY-MM)' });
            }
            const parsed = dayjs.tz(month, 'YYYY-MM', RESTAURANT_TZ);
            if (!parsed.isValid()) {
                return res.status(400).json({ error: 'Invalid month, expected YYYY-MM' });
            }

            const rows = await prisma.booking.findMany({
                where: {
                    tenantId: tenantId(req),
                    deletedAt: null,
                    status: { not: 'CANCELLED' },
                    startTime: { gte: parsed.startOf('month').toDate(), lte: parsed.endOf('month').toDate() },
                } as any,
                select: { startTime: true },
            });

            const counts: Record<string, number> = {};
            for (const row of rows) {
                const key = dayjs(row.startTime).tz(RESTAURANT_TZ).format('YYYY-MM-DD');
                counts[key] = (counts[key] ?? 0) + 1;
            }
            res.json(counts);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to load affluence' });
        }
    },

    updateAssignment: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const { tableNames }: { tableNames: string[] } = req.body;
            const tid = tenantId(req);

            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any);
            if (!existing) return res.status(404).json({ error: 'Booking not found' });

            const prismaTables = await prisma.table.findMany({
                where: { tenantId: tid, name: { in: tableNames } }
            });

            await prisma.booking.update({
                where: { id: id },
                data: {
                    tables: {
                        set: [],
                        connect: prismaTables.map((t: any) => ({ id: t.id }))
                    }
                }
            } as any);

            const completeBooking: Booking | null = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });

            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update assignment' });
        }
    },

    rescheduleBooking: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const { startTime, size, tableNames } = (req.body ?? {}) as {
                startTime?: string;
                size?: number;
                tableNames?: string[];
            };
            const result = await rescheduleBooking({
                bookingId: id,
                tenantId: tid,
                startTime: startTime !== undefined ? new Date(startTime) : undefined,
                size,
                tableNames,
            });
            if ('conflict' in result) {
                return res.status(409).json(result);
            }
            const completeBooking = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any,
            });
            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            const msg = error instanceof Error ? error.message : '';
            if (/not found/i.test(msg)) return res.status(404).json({ error: msg });
            if (/Invalid|Unknown|Nothing|closed|not available/i.test(msg)) {
                return res.status(400).json({ error: msg });
            }
            console.error(error);
            res.status(500).json({ error: 'Failed to reschedule booking' });
        }
    },

        toggleGuestConfirm: async (req: AuthRequest, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const tid = tenantId(req);
            const existing = await prisma.booking.findFirst({
                where: { id: id, tenantId: tid, deletedAt: null }
            } as any);
            if (!existing) return res.status(404).json({ error: 'Booking not found' });
            if ((existing as any).status === 'CANCELLED') {
                return res.status(400).json({ error: 'Cannot confirm a cancelled booking' });
            }
            const { confirmed }: { confirmed?: boolean } = req.body ?? {};
            await prisma.booking.update({
                where: { id: id },
                data: { guestConfirmed: confirmed ?? !(existing as any).guestConfirmed }
            } as any);
            const completeBooking = await prisma.booking.findUnique({
                where: { id: id },
                include: { tables: true } as any
            });
            emitToTenant(io, tenantId(req), 'booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update confirmation' });
        }
    },

    getAnalytics: async (req: AuthRequest, res: Response) => {        try {
            const { date } = req.query;
            if (!date || typeof date !== 'string') {
                return res.status(400).json({ error: 'Missing date (YYYY-MM-DD)' });
            }

            res.json(await getDailyAnalytics(date, tenantId(req)));
        } catch (error) {
            console.error(error);
            if ((error as Error).message?.startsWith('Invalid date')) {
                return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getRangeAnalytics: async (req: AuthRequest, res: Response) => {
        try {
            const { from, to } = req.query;
            if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
                return res.status(400).json({ error: 'Missing from/to (YYYY-MM-DD)' });
            }
            res.json(await getRangeAnalytics(from, to, tenantId(req)));
        } catch (error) {
            console.error(error);
            if ((error as Error).message?.startsWith('Invalid range') || (error as Error).message?.startsWith('Range too wide')) {
                return res.status(400).json({ error: (error as Error).message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
