
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { bookingController } from '../controllers/bookingController';
import { prisma } from '../lib/prisma';
import { emailService } from './emailService';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
    prisma: {
        booking: {
            create: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        table: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock('./emailService', () => ({
    emailService: {
        sendConfirmationEmail: vi.fn(),
        sendFeedbackEmail: vi.fn(),
    },
}));

vi.mock('./bookingService', () => ({
    getAvailableTables: vi.fn().mockResolvedValue([]),
    findTableCombination: vi.fn().mockReturnValue([]),
    addMinutes: (d: Date, m: number) => new Date(d.getTime() + m * 60000),
}));

describe('bookingController Integration', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let json: any;
    let status: any;
    let io: any;

    beforeEach(() => {
        vi.clearAllMocks();

        json = vi.fn();
        status = vi.fn().mockReturnValue({ json });
        res = { json, status };

        // Mock Socket.IO
        io = { emit: vi.fn() };
    });

    describe('createBooking (Quick Reservation)', () => {
        it('should create a booking successfully and send confirmation email', async () => {
            req = {
                body: {
                    name: 'John Doe',
                    phone: '123456789',
                    email: 'john@example.com',
                    size: '4', // coming as string from form-data often, or JSON number. Controller parses it.
                    startTime: '2026-05-20T19:00:00.000Z',
                    language: 'en',
                    highTable: false
                }
            };

            const mockCreatedBooking = {
                id: 'booking-123',
                ...req.body,
                size: 4,
                startTime: new Date('2026-05-20T19:00:00.000Z'),
                email: 'john@example.com'
            };

            (prisma.booking.create as any).mockResolvedValue(mockCreatedBooking);

            await bookingController(io).createBooking(req as Request, res as Response);

            expect(prisma.booking.create).toHaveBeenCalled();
            expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(mockCreatedBooking);
            expect(io.emit).toHaveBeenCalledWith('booking-update', { type: 'new', booking: mockCreatedBooking });
            expect(json).toHaveBeenCalledWith(mockCreatedBooking);
        });

        it('should return 400 if missing required fields', async () => {
            req = {
                body: {
                    name: 'John Doe',
                    // Missing size and startTime
                }
            };

            await bookingController(io).createBooking(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing fields' }));
            expect(prisma.booking.create).not.toHaveBeenCalled();
        });
    });

    describe('updateAssignment (Assign Tables)', () => {
        it('should update booking with assigned tables', async () => {
            req = {
                params: { id: 'booking-123' },
                body: { tableNames: ['10', '9'] }
            };

            const mockTables = [
                { id: 1, name: '10' },
                { id: 2, name: '9' }
            ];

            (prisma.table.findMany as any).mockResolvedValue(mockTables);
            (prisma.booking.update as any).mockResolvedValue({}); // update result typically ignored for return, we fetch again or return object

            const mockUpdatedBooking = {
                id: 'booking-123',
                tables: mockTables
            };
            (prisma.booking.findUnique as any).mockResolvedValue(mockUpdatedBooking);

            await bookingController(io).updateAssignment(req as Request, res as Response);

            expect(prisma.table.findMany).toHaveBeenCalledWith({ where: { name: { in: ['10', '9'] } } });
            expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'booking-123' },
                data: expect.objectContaining({
                    tables: {
                        set: [],
                        connect: [{ id: 1 }, { id: 2 }]
                    }
                })
            }));
            expect(io.emit).toHaveBeenCalledWith('booking-update', { type: 'update', booking: mockUpdatedBooking });
            expect(json).toHaveBeenCalledWith(mockUpdatedBooking);
        });
    });

    describe('cancelBooking', () => {
        it('should cancel a booking and notify via socket', async () => {
            req = {
                params: { id: 'booking-123' }
            };

            const mockCancelledBooking = {
                id: 'booking-123',
                status: 'CANCELLED',
                tables: []
            };

            (prisma.booking.update as any).mockResolvedValue({ id: 'booking-123', status: 'CANCELLED' });
            (prisma.booking.findUnique as any).mockResolvedValue(mockCancelledBooking);

            await bookingController(io).cancelBooking(req as Request, res as Response);

            expect(prisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-123' },
                data: { status: 'CANCELLED' }
            });
            expect(io.emit).toHaveBeenCalledWith('booking-update', { type: 'update', booking: mockCancelledBooking });
            expect(json).toHaveBeenCalledWith(mockCancelledBooking);
        });

        it('should handle errors gracefully', async () => {
            req = { params: { id: 'unknown-id' } };
            (prisma.booking.update as any).mockRejectedValue(new Error('Record not found'));

            await bookingController(io).cancelBooking(req as Request, res as Response);

            expect(status).toHaveBeenCalledWith(500);
            expect(json).toHaveBeenCalledWith({ error: 'Failed to cancel booking' });
        });
    });
});
