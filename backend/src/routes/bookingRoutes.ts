import { Router } from 'express';
import { bookingController } from '../controllers/bookingController';
import { Server } from 'socket.io';
import { isAuthenticated, requireTenant, requireActiveTrial, resolveTenantFromSlug, requireRole } from '../middleware/isAuthenticated';
import { availabilityLimiter, bookingLimiter } from '../middleware/rateLimit';

export const bookingRoutes = (io: Server) => {
    const router = Router();
    const controller = bookingController(io);

    /**
     * @swagger
     * tags:
     *   name: Bookings
     *   description: Booking management
     */

    /**
     * @swagger
     * /analytics:
     *   get:
     *     summary: Get booking analytics
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Booking statistics
     */
    router.get('/analytics', isAuthenticated, requireTenant, controller.getAnalytics);

    /**
     * @swagger
     * /analytics/range:
     *   get:
     *     summary: Range analytics (KPIs, heatmap, sizes, turnover, CRM)
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: from
     *         required: true
     *         schema: { type: string }
     *       - in: query
     *         name: to
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Range statistics (max 366 days)
     *       400:
     *         description: Invalid range
     */
    router.get('/analytics/range', isAuthenticated, requireTenant, controller.getRangeAnalytics);

    /**
     * @swagger
     * /daily-availability:
     *   get:
     *     summary: Get daily availability
     *     tags: [Bookings]
     *     parameters:
     *       - in: query
     *         name: date
     *         schema:
     *           type: string
     *         required: true
     *         description: Date in YYYY-MM-DD format
     *       - in: query
     *         name: size
     *         schema:
     *           type: integer
     *         description: Party size
     *       - in: query
     *         name: slug
     *         schema:
     *           type: string
     *         required: true
     *         description: Restaurant slug
     *     responses:
     *       200:
     *         description: Availability status
     */
    router.get('/daily-availability', availabilityLimiter, resolveTenantFromSlug, controller.getDailyAvailability);

    /**
     * @swagger
     * /hours:
     *   get:
     *     summary: Public opening-hours grid for a date (booking widget)
     *     tags: [Bookings]
     *     parameters:
     *       - in: query
     *         name: date
     *         required: true
     *         schema:
     *           type: string
     *         description: Date in YYYY-MM-DD format
     *       - in: query
     *         name: slug
     *         required: true
     *         schema:
     *           type: string
     *         description: Restaurant slug
     *     responses:
     *       200:
     *         description: Open flag + bookable slots (hours only)
     */
    router.get('/hours', availabilityLimiter, resolveTenantFromSlug, controller.getOpenHours);

    /**
     * @swagger
     * /availability:
     *   get:
     *     summary: Check table availability
     *     tags: [Bookings]
     *     parameters:
     *       - in: query
     *         name: date
     *         schema:
     *           type: string
     *         required: true
     *         description: Date in YYYY-MM-DD format
     *       - in: query
     *         name: time
     *         schema:
     *           type: string
     *         description: Time in HH:mm format
     *       - in: query
     *         name: size
     *         schema:
     *           type: integer
     *         description: Party size
     *       - in: query
     *         name: slug
     *         schema:
     *           type: string
     *         required: true
     *         description: Restaurant slug
     *     responses:
     *       200:
     *         description: Availability status
     */
    router.get('/availability', availabilityLimiter, resolveTenantFromSlug, controller.checkAvailability);

    /**
     * @swagger
     * /bookings:
     *   post:
     *     summary: Create a new booking
     *     tags: [Bookings]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/Booking'
     *     responses:
     *       201:
     *         description: Booking created
     */
    router.post('/bookings', bookingLimiter, resolveTenantFromSlug, requireActiveTrial, controller.createBooking);

    /**
     * @swagger
     * /bookings:
     *   get:
     *     summary: Get bookings (optionally scoped to a single day)
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: date
     *         required: false
     *         schema:
     *           type: string
     *           example: '2026-10-02'
     *         description: Restaurant-day (YYYY-MM-DD, Europe/Paris). Omit for the full history.
     *     responses:
     *       200:
     *         description: List of bookings
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Booking'
     */
    router.get('/bookings', isAuthenticated, requireTenant, controller.getAllBookings);

    /**
     * @swagger
     * /bookings/affluence:
     *   get:
     *     summary: Per-day booking counts for a month (agenda calendar dots)
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: month
     *         required: true
     *         schema:
     *           type: string
     *           example: '2026-10'
     *     responses:
     *       200:
     *         description: Map of YYYY-MM-DD → booking count
     */
    router.get('/bookings/affluence', isAuthenticated, requireTenant, controller.getAffluence);

    router.patch('/bookings/:id/tables', isAuthenticated, requireTenant, requireActiveTrial, controller.updateAssignment);
    router.post('/bookings/:id/guest-confirm', isAuthenticated, requireTenant, requireActiveTrial, controller.toggleGuestConfirm);
    /**
     * @swagger
     * /bookings/reconciliation:
     *   get:
     *     summary: End-of-shift reconciliation — unresolved HELD holds (last 24h)
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Unresolved holds to release or capture before Stripe expiry
     */
    router.get('/bookings/reconciliation', isAuthenticated, requireTenant, controller.getReconciliationHolds);
    /**
     * @swagger
     * /bookings/{id}/no-show:
     *   post:
     *     summary: Mark No-Show & Charge — the ONLY capture trigger (HELD → CAPTURED)
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: No-show fee captured
     *       404:
     *         description: Booking not found
     *       409:
     *         description: No capturable hold (not HELD)
     */
    router.post('/bookings/:id/no-show', isAuthenticated, requireTenant, requireActiveTrial, controller.markNoShowAndCharge);
    /**
     * @swagger
     * /bookings/{id}:
     *   patch:
     *     summary: Reschedule a booking (time/size), keeping tables when compatible
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Rescheduled booking
     *       409:
     *         description: Kept tables conflict — returns a suggested combination
     */
    router.patch('/bookings/:id', isAuthenticated, requireTenant, requireActiveTrial, controller.rescheduleBooking);
    router.post('/bookings/:id/check-in', isAuthenticated, requireTenant, requireActiveTrial, controller.checkIn);
    router.post('/bookings/:id/finish', isAuthenticated, requireTenant, requireActiveTrial, controller.finishMeal);
    router.post('/bookings/:id/cancel', isAuthenticated, requireTenant, requireActiveTrial, controller.cancelBooking);

    /**
     * @swagger
     * /bookings/{id}:
     *   delete:
     *     summary: GDPR Art.17 — soft-delete a booking and wipe its PII
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Erasure confirmation
     *       404:
     *         description: Booking not found
     */
    router.delete('/bookings/:id', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), controller.eraseBooking);

    return router;
};
