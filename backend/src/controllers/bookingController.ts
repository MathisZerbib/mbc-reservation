import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';
import { getAvailableTables, findTableCombination, addMinutes, RESERVATION_DURATION, getSuggestions, createReservation, MIN_BOOKING_ADVANCE_HOURS } from '../services/bookingService';
import { Server } from 'socket.io';
import { emailService } from '../services/emailService';
import { Booking } from '../types/booking';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = 'Europe/Paris';

const getIsAdmin = (req: Request) => {
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




export const bookingController = (io: Server) => ({
    checkAvailability: async (req: Request, res: Response) => {
        try {
            const { date, time, size } = req.query;
            if (!date || !time || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            // Parse requested time specifically in the restaurant's timezone
            const requestedStart = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ);
            if (isNaN(requestedStart.toDate().getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            // 2h buffer check (admin bypass)
            if (!getIsAdmin(req) && requestedStart.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) {
                const suggestions = await getSuggestions(date as string, guestSize, time as string);
                return res.json({
                    available: false,
                    tables: [],
                    suggestions
                });
            }

            const requestedEnd = addMinutes(requestedStart.toDate(), RESERVATION_DURATION);

            const available = await getAvailableTables(requestedStart.toDate(), requestedEnd);
            const combination = findTableCombination(guestSize, available);

            let suggestions: string[] = [];
            if (!combination) {
                suggestions = await getSuggestions(date as string, guestSize, time as string);
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

    getDailyAvailability: async (req: Request, res: Response) => {
        try {
            const { date, size } = req.query;
            if (!date || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

            const isAdmin = getIsAdmin(req);
            const results = await Promise.all(TIME_SLOTS.map(async (time) => {
                const start = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ);

                // 2h buffer check (admin bypass)
                if (!isAdmin && start.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) {
                    return { time, available: false };
                }

                const end = addMinutes(start.toDate(), RESERVATION_DURATION);
                const available = await getAvailableTables(start.toDate(), end);
                const combination = findTableCombination(guestSize, available);
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

    createBooking: async (req: Request, res: Response) => {
        try {
            let { name, phone, email, size, startTime, language, lowTable, notify } = req.body;

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

            // 4. Atomic Execution
            const newBooking = await createReservation({
                name,
                phone,
                email,
                language: language || 'fr',
                size: guestSize,
                startTime: requestedStart.toDate(),
                lowTable: lowTable || false
            });

            // Send confirmation email
            if (newBooking.email && notify !== false) {
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
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const updatedBooking = await prisma.booking.update({
                where: { id: id },
                data: { status: 'COMPLETED' }
            } as any);

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

            io.emit('booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to check-in' });
        }
    },

    cancelBooking: async (req: Request, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const updatedBooking = await prisma.booking.update({
                where: { id: id },
                data: { status: 'CANCELLED' }
            } as any);

            const completeBooking = await prisma.booking.findUnique({
                where: { id: id },
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
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];
            const { tableNames }: { tableNames: string[] } = req.body;

            const prismaTables = await prisma.table.findMany({
                where: { name: { in: tableNames } }
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

            io.emit('booking-update', { type: 'update', booking: completeBooking });
            res.json(completeBooking);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update assignment' });
        }
    },

    updateBooking: async (req: Request, res: Response) => {
        try {
            let { id } = req.params;
            if (Array.isArray(id)) id = id[0];

            let { name, phone, email, size, startTime, language, lowTable } = req.body;

            // Sanitize & validate only provided fields
            if (name !== undefined) {
                name = String(name).trim().substring(0, 20);
                if (name.length < 2) {
                    return res.status(400).json({ error: 'Name too short (min 2 characters)' });
                }
            }

            if (email !== undefined && email !== null && email !== '') {
                email = String(email).trim().toLowerCase().substring(0, 24);
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    return res.status(400).json({ error: 'Invalid email format' });
                }
            } else if (email === '') {
                email = null;
            }

            if (phone !== undefined && phone !== null && phone !== '') {
                phone = String(phone).trim().substring(0, 20);
                if (!/^\+?[\d\s-]{8,}$/.test(phone)) {
                    return res.status(400).json({ error: 'Invalid phone format' });
                }
            } else if (phone === '') {
                phone = null;
            }

            if (size !== undefined) {
                const guestSize = parseInt(size);
                if (isNaN(guestSize) || guestSize < 1 || guestSize > 100) {
                    return res.status(400).json({ error: 'Invalid guest size' });
                }
                size = guestSize;
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name;
            if (email !== undefined) updateData.email = email;
            if (phone !== undefined) updateData.phone = phone;
            if (size !== undefined) updateData.size = size;
            if (language !== undefined) updateData.language = language;
            if (lowTable !== undefined) updateData.lowTable = lowTable;

            if (startTime !== undefined) {
                const requestedStart = dayjs.tz(startTime, RESTAURANT_TZ);
                if (isNaN(requestedStart.toDate().getTime())) {
                    return res.status(400).json({ error: 'Invalid date/time' });
                }
                updateData.startTime = requestedStart.toDate();
                updateData.endTime = addMinutes(requestedStart.toDate(), RESERVATION_DURATION);
            }

            await prisma.booking.update({
                where: { id },
                data: updateData
            } as any);

            const updatedBooking: Booking | null = await prisma.booking.findUnique({
                where: { id },
                include: { tables: true } as any
            });

            io.emit('booking-update', { type: 'update', booking: updatedBooking });
            res.json(updatedBooking);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update booking' });
        }
    },

    getAnalytics: async (req: Request, res: Response) => {
        try {
            const { date } = req.query;
            if (!date) return res.status(400).json({ error: 'Missing date' });

            const startOfDay = dayjs.tz(`${date}T00:00:00`, RESTAURANT_TZ).toDate();
            const endOfDay = dayjs.tz(`${date}T23:59:59`, RESTAURANT_TZ).toDate();

            const bookings = await prisma.booking.findMany({
                where: {
                    startTime: { gte: startOfDay, lte: endOfDay },
                    status: { not: 'CANCELLED' }
                },
                select: {
                    size: true,
                    startTime: true,
                    endTime: true
                }
            });

            const totalBookings = bookings.length;
            const totalGuests = bookings.reduce((sum, b) => sum + b.size, 0);
            const turnover = totalGuests * 55;

            // Calculate Peak Hour (Time with most guests arriving)
            const arrivalCounts: Record<string, number> = {};
            bookings.forEach(b => {
                const slot = dayjs(b.startTime).tz(RESTAURANT_TZ).format('HH:mm');
                arrivalCounts[slot] = (arrivalCounts[slot] || 0) + b.size;
            });

            let peakHour = '—';
            let maxArrivals = 0;

            Object.entries(arrivalCounts).forEach(([slot, count]) => {
                if (count > maxArrivals) {
                    maxArrivals = count;
                    peakHour = slot;
                }
            });

            res.json({
                totalBookings,
                turnover,
                peakHour,
                growth: "+12%"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
