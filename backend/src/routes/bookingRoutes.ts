import { Router } from 'express';
import { bookingController } from '../controllers/bookingController';
import { Server } from 'socket.io';
import { isAuthenticated } from '../middleware/isAuthenticated';

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
     *     responses:
     *       200:
     *         description: Booking statistics
     */
    router.get('/analytics', controller.getAnalytics);

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
     *     responses:
     *       200:
     *         description: Availability status
     */
    router.get('/daily-availability', controller.getDailyAvailability);

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
     *     responses:
     *       200:
     *         description: Availability status
     */
    router.get('/availability', controller.checkAvailability);

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
    router.post('/bookings', controller.createBooking);

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
    router.get('/bookings', isAuthenticated, controller.getAllBookings);

    router.patch('/bookings/:id', isAuthenticated, controller.updateBooking);
    router.patch('/bookings/:id/tables', isAuthenticated, controller.updateAssignment);
    router.post('/bookings/:id/check-in', isAuthenticated, controller.checkIn);
    router.post('/bookings/:id/cancel', isAuthenticated, controller.cancelBooking);

    return router;
};
