import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { getAvailableTables, findTableCombination, addMinutes } from '../services/bookingService';
import { Server } from 'socket.io';
import { emailService } from '../services/emailService';

// Interfaces for types
interface Table {
    id: number;
    name: string;
    // Add other properties if needed
}

interface Booking {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    language: string;
    size: number;
    startTime: Date | string;
    endTime: Date | string;
    status?: string;
    highTable?: boolean;
    tables?: Table[];
    // Add other properties if needed
}

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
            const { name, phone, email, size, startTime, language, highTable } = req.body;
            const missingFields: string[] = [];
            if (!name) missingFields.push('name');
            if (!size) missingFields.push('size');
            if (!startTime) missingFields.push('startTime');
            if (missingFields.length > 0) {
                return res.status(400).json({ error: 'Missing fields', missingFields });
            }

            const guestSize = parseInt(size);
            const requestedStart = new Date(startTime);
            if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

            const duration = getDuration(guestSize);
            const requestedEnd = addMinutes(requestedStart, duration);

            const newBooking = await prisma.booking.create({
                data: {
                    name: name,
                    phone: phone || null,
                    email: email || null,
                    language: language || 'fr', // always a string
                    size: guestSize,
                    startTime: requestedStart,
                    endTime: requestedEnd,
                    highTable: highTable || false,
                    tables: {
                        connect: [] // Manager will assign tables manually
                    }
                }
            } as any);

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
