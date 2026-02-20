import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { getAvailableTables, findTableCombination, addMinutes, RESERVATION_DURATION, getSuggestions, createReservation } from '../services/bookingService';
import { Server } from 'socket.io';
import { emailService } from '../services/emailService';
import { Table, Booking } from '../types/booking';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = 'Europe/Paris';




export const bookingController = (io: Server) => ({
    checkAvailability: async (req: Request, res: Response) => {
        try {
            const { date, time, size } = req.query;
            if (!date || !time || !size) return res.status(400).json({ error: 'Missing parameters' });

            const guestSize = parseInt(size as string);
            // Parse requested time specifically in the restaurant's timezone
            const requestedStart = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ).toDate();
            if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            const requestedEnd = addMinutes(requestedStart, RESERVATION_DURATION);

            const available = await getAvailableTables(requestedStart, requestedEnd);
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

            const results = await Promise.all(TIME_SLOTS.map(async (time) => {
                const start = dayjs.tz(`${date}T${time}`, RESTAURANT_TZ).toDate();
                const end = addMinutes(start, RESERVATION_DURATION);
                const available = await getAvailableTables(start, end);
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
            const { name, phone, email, size, startTime, language, highTable } = req.body;
            const missingFields: string[] = [];
            if (!name) missingFields.push('name');
            if (!size) missingFields.push('size');
            if (!startTime) missingFields.push('startTime');
            if (missingFields.length > 0) {
                return res.status(400).json({ error: 'Missing fields', missingFields });
            }

            const guestSize = parseInt(size);
            // Parse requested time specifically in the restaurant's timezone
            // Parse as absolute time (UTC) and then convert to restaurant timezone object
            console.log(`📩 [createBooking] Received request: ${name}, size: ${size}, startTime: ${startTime}, highTable: ${highTable}`);
            const requestedStart = dayjs(startTime).tz(RESTAURANT_TZ).toDate();
            console.log(`⏰ [createBooking] Parsed requestedStart: ${requestedStart.toISOString()} (Local: ${dayjs(requestedStart).tz(RESTAURANT_TZ).format()})`);
            if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            // Transactional booking: availability check + table assignment + create
            // all happen atomically — prevents race-condition double bookings
            const newBooking = await createReservation({
                name,
                phone: phone || null,
                email: email || null,
                language: language || 'fr',
                size: guestSize,
                startTime: requestedStart,
                highTable: highTable || false
            });

            // Send confirmation email
            if (newBooking.email) {
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

    getAnalytics: async (req: Request, res: Response) => {
        try {
            const { date } = req.query;
            if (!date) return res.status(400).json({ error: 'Missing date' });

            const startOfDay = new Date(`${date}T00:00:00`);
            const endOfDay = new Date(`${date}T23:59:59`);

            interface BookingForAnalytics {
                size: number;
                startTime: Date | string;
                endTime: Date | string;
            }

            const bookings: BookingForAnalytics[] = await prisma.booking.findMany({
                where: {
                    startTime: { gte: startOfDay, lte: endOfDay },
                    status: { not: 'CANCELLED' }
                }
            });

            const totalBookings: number = bookings.length;
            const totalGuests: number = bookings.reduce((sum: number, b: BookingForAnalytics) => sum + b.size, 0);
            const turnover: number = totalGuests * 55; // Assuming avg 55€ per guest

            // Calculate Peak Hour
            const slots: string[] = [];
            for (let h = 17; h <= 22; h++) {
                slots.push(`${h}:00`, `${h}:30`);
            }

            let peakHour: string = '19:00';
            let maxOverlaps: number = -1;

            slots.forEach((slot: string) => {
                const slotTime = new Date(`${date}T${slot.length === 4 ? '0' + slot : slot}`);
                const overlaps: number = bookings.filter((b: BookingForAnalytics) => {
                    const start: Date = new Date(b.startTime);
                    const end: Date = new Date(b.endTime);
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
                growth: "+12%"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
