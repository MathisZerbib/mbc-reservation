import { Router } from 'express';
import { bookingController } from '../controllers/bookingController';
import { Server } from 'socket.io';
import { isAuthenticated } from '../middleware/isAuthenticated';

export const bookingRoutes = (io: Server) => {
    const router = Router();
    const controller = bookingController(io);

    router.get('/analytics', controller.getAnalytics);
    router.get('/availability', controller.checkAvailability);
    router.post('/bookings', controller.createBooking);

    router.get('/bookings', isAuthenticated, controller.getAllBookings);
    router.patch('/bookings/:id/tables', isAuthenticated, controller.updateAssignment);
    router.post('/bookings/:id/check-in', isAuthenticated, controller.checkIn);
    router.post('/bookings/:id/cancel', isAuthenticated, controller.cancelBooking);

    return router;
};
