import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getAvailableTables, findTableCombination, addMinutes } from '../services/bookingService';
import { Server } from 'socket.io';
import { emailService } from '../services/emailService';

const getDuration = (guestSize: number) => (guestSize >= 6 ? 180 : 120);

export const bookingController = (io: Server) => ({
    checkAvailability: async (req: Request, res: Response) => {
        try {
            const { date, time, size } = req.query;
            if (!date || !time || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            const requestedStart = new Date(`${date}T${time}`);
            if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            const duration = getDuration(guestSize);
            const requestedEnd = addMinutes(requestedStart, duration);

            const available = await getAvailableTables(requestedStart, requestedEnd);
            const combination = findTableCombination(guestSize, available);

            res.json({
                available: !!combination,
                tables: combination || []
            });
        } catch (e) {
            console.error('Availability error:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createBooking: async (req: Request, res: Response) => {
        try {
            const { name, phone, email, size, date, time, language } = req.body;
            if (!name || !size || !date || !time) return res.status(400).json({ error: 'Missing fields' });

            const guestSize = parseInt(size);
            const requestedStart = new Date(`${date}T${time}`);
            if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            const duration = getDuration(guestSize);
            const requestedEnd = addMinutes(requestedStart, duration);

            const newBooking = await prisma.booking.create({
                data: {
                    guestName: name,
                    guestPhone: phone || null,
                    guestEmail: email || null,
                    language: language || null,
                    size: guestSize,
                    startTime: requestedStart,
                    endTime: requestedEnd,
                    tables: {
                        connect: [] // Manager will assign tables manually
                    }
                }
            } as any);

            // Send confirmation email
            if (newBooking.guestEmail) {
                emailService.sendConfirmationEmail(newBooking);
            }

            io.emit('booking-update', { type: 'new', booking: newBooking });
            res.json(newBooking);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    checkIn: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updatedBooking = await prisma.booking.update({
                where: { id: id as string },
                data: { status: 'COMPLETED' }
            } as any);

            // Send feedback email after visit
            if (updatedBooking.guestEmail) {
                emailService.sendFeedbackEmail(updatedBooking);
            }

            const completeBooking = await prisma.booking.findUnique({
                where: { id: id as string },
                include: { tables: true } as any
            });

            io.emit('booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to check-in' });
        }
    },

    cancelBooking: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updatedBooking = await prisma.booking.update({
                where: { id: id as string },
                data: { status: 'CANCELLED' }
            } as any);

            const completeBooking = await prisma.booking.findUnique({
                where: { id: id as string },
                include: { tables: true } as any
            });

            io.emit('booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to cancel booking' });
        }
    },

    getAllBookings: async (req: Request, res: Response) => {
        try {
            const bookings = await prisma.booking.findMany({
                include: { tables: true } as any
            });
            res.json(bookings);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateAssignment: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { tableNames } = req.body;

            const tables = await prisma.table.findMany({
                where: { name: { in: tableNames } }
            });

            await prisma.booking.update({
                where: { id: id as string },
                data: {
                    tables: {
                        set: [],
                        connect: tables.map(t => ({ id: t.id }))
                    }
                }
            } as any);

            const completeBooking = await prisma.booking.findUnique({
                where: { id: id as string },
                include: { tables: true } as any
            });

            io.emit('booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update assignment' });
        }
    },

    getAnalytics: async (req: Request, res: Response) => {
        try {
            const { date } = req.query;
            if (!date) return res.status(400).json({ error: 'Missing date' });

            const startOfDay = new Date(`${date}T00:00:00`);
            const endOfDay = new Date(`${date}T23:59:59`);

            const bookings = await prisma.booking.findMany({
                where: {
                    startTime: { gte: startOfDay, lte: endOfDay },
                    status: { not: 'CANCELLED' }
                }
            });

            const totalBookings = bookings.length;
            const totalGuests = bookings.reduce((sum, b) => sum + b.size, 0);
            const turnover = totalGuests * 55; // Assuming avg 55€ per guest

            // Calculate Peak Hour
            const slots = [];
            for (let h = 17; h <= 22; h++) {
                slots.push(`${h}:00`, `${h}:30`);
            }

            let peakHour = '19:00';
            let maxOverlaps = -1;

            slots.forEach(slot => {
                const slotTime = new Date(`${date}T${slot.length === 4 ? '0' + slot : slot}`);
                const overlaps = bookings.filter(b => {
                    const start = new Date(b.startTime);
                    const end = new Date(b.endTime);
                    return slotTime >= start && slotTime < end;
                }).length;

                if (overlaps > maxOverlaps) {
                    maxOverlaps = overlaps;
                    peakHour = slot;
                }
            });

            res.json({
                totalBookings,
                turnover,
                peakHour,
                growth: "+12%" // Placeholder for now
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
