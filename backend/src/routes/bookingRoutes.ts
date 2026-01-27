import { Router } from 'express';
import { bookingController } from '../controllers/bookingController';
import { Server } from 'socket.io';

export const bookingRoutes = (io: Server) => {
    const router = Router();
    const controller = bookingController(io);

    router.get('/availability', controller.checkAvailability);
    router.post('/bookings', controller.createBooking);
    router.get('/bookings', controller.getAllBookings);
    router.patch('/bookings/:id/tables', controller.updateAssignment);
    router.post('/bookings/:id/check-in', controller.checkIn);
    router.post('/bookings/:id/cancel', controller.cancelBooking);

    return router;
};
