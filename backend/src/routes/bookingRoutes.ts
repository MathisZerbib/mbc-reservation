import { Router } from 'express';
import { bookingController } from '../controllers/bookingController';
import { Server } from 'socket.io';
import { isAuthenticated, requireTenant, requireActiveTrial, resolveTenantFromSlug } from '../middleware/isAuthenticated';
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
     *     summary: Get all bookings
     *     tags: [Bookings]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of all bookings
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Booking'
     */
    router.get('/bookings', isAuthenticated, requireTenant, controller.getAllBookings);

    router.patch('/bookings/:id/tables', isAuthenticated, requireTenant, requireActiveTrial, controller.updateAssignment);
    router.post('/bookings/:id/guest-confirm', isAuthenticated, requireTenant, requireActiveTrial, controller.toggleGuestConfirm);
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
    router.post('/bookings/:id/cancel', isAuthenticated, requireTenant, requireActiveTrial, controller.cancelBooking);

    return router;
};
