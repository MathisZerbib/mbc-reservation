import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { Response } from 'express';
import { AuthRequest } from '../middleware/isAuthenticated';
import { bookingController } from '../controllers/bookingController';
import { prisma } from '../lib/prisma'; // Real prisma
import { emailService } from './emailService';
import { FLOOR_PLAN_DATA, getCapacity } from '../utils/floorPlanData';

// Only mock email service to avoid sending real emails
vi.mock('./emailService', () => ({
    emailService: {
        sendConfirmationEmail: vi.fn(),
        sendFeedbackEmail: vi.fn(),
    },
}));

// We do NOT mock bookingService or prisma anymore. We test the Full Flow.
//
// Destructive suite scoped to an isolated test tenant (created/deleted per run).
// Opt-in only (RUN_DB_TESTS=1) so a plain `npm test` never touches a real DB.
describe.runIf(process.env.RUN_DB_TESTS === '1')('bookingController Integration (Real DB)', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;
    let json: any;
    let status: any;
    let io: any;
    let tenantId: string;
    const tenant = () => ({ id: tenantId, slug: 'test', name: 'Test', trialEndsAt: new Date(Date.now() + 86400000), onboardingComplete: false });

    beforeAll(async () => {
        // ISOLATED TENANT + SEED
        const t = await prisma.tenant.create({
            data: {
                name: 'Test Tenant',
                slug: `test-${Date.now()}`,
                trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        tenantId = t.id;

        for (const t of FLOOR_PLAN_DATA) {
            await prisma.table.create({
                data: {
                    name: t.id,
                    capacity: getCapacity(t),
                    type: t.shape === 'BAR' ? 'BAR' : 'RECTANGULAR',
                    x: t.x,
                    y: t.y,
                    tenantId,
                }
            });
        }
    });

    afterAll(async () => {
        await prisma.tenant.deleteMany({ where: { id: tenantId } });
    });

    beforeEach(async () => {
        // Reset bookings only
        await prisma.booking.deleteMany({ where: { tenantId } });
        vi.clearAllMocks();

        json = vi.fn();
        status = vi.fn().mockReturnValue({ json });
        res = { json, status };
        io = { emit: vi.fn() };
    });

    describe('createBooking (Quick Reservation)', () => {
        it('should create a booking successfully in DB and assign a real table', async () => {
            req = {
                tenant: tenant(),
                body: {
                    name: 'John Doe',
                    phone: '123456789',
                    email: 'john@example.com',
                    size: '2', // requesting 2 people
                    startTime: new Date().toISOString(), // Immediate booking (assuming avail)
                    language: 'en',
                    lowTable: false
                }
            };
            
            // NOTE: We need a future date to ensure availability isn't blocked by "past" logic? 
            // Or just use tomorrow 19:00
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(19, 0, 0, 0);
            req.body.startTime = tomorrow.toISOString();

            await bookingController(io).createBooking(req as AuthRequest, res as Response);

            // 1. Check HTTP Response
            if (json.mock.calls[0][0].error) {
                console.log('Error from controller:', json.mock.calls[0][0]);
            }
            expect(json).toHaveBeenCalled();
            const createdBooking = json.mock.calls[0][0];
            expect(createdBooking).toHaveProperty('id');
            expect(createdBooking.name).toBe('John Doe');
            
            // 2. Check DB side-effects
            const dbBooking = await prisma.booking.findUnique({
                where: { id: createdBooking.id },
                include: { tables: true }
            });
            expect(dbBooking).toBeDefined();
            expect(dbBooking?.tables.length).toBeGreaterThan(0); // Should have auto-assigned a table!
            
            // 3. Check Email & Socket
            expect(emailService.sendConfirmationEmail).toHaveBeenCalled();
            expect(io.emit).toHaveBeenCalledWith('booking-update', expect.objectContaining({ type: 'new' }));
        });

        it('should return 400 if missing required fields', async () => {
            req = {
                tenant: tenant(),
                body: {
                    name: 'Bad Request',
                    // Missing size/time
                }
            };
            await bookingController(io).createBooking(req as AuthRequest, res as Response);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Missing fields' }));
        });
    });

    describe('updateAssignment (Manual Override)', () => {
        it('should manually re-assign tables from existing floor plan', async () => {
            // 1. Create a booking first
            const table30 = await prisma.table.findFirstOrThrow({ where: { tenantId, name: '30' } });
            const existing = await prisma.booking.create({
                data: {
                    name: 'Manual Mover',
                    size: 2,
                    startTime: new Date(),
                    endTime: new Date(),
                    language: 'en',
                    tenantId,
                    tables: { connect: { id: table30.id } }
                }
            });

            // 2. Request to move to '10' and '9'
            req = {
                tenant: tenant(),
                params: { id: existing.id },
                body: { tableNames: ['10', '9'] }
            };

            await bookingController(io).updateAssignment(req as AuthRequest, res as Response);

            // 3. Verify in DB
            const updated = await prisma.booking.findUnique({
                where: { id: existing.id },
                include: { tables: true }
            });
            
            const tableNames = updated?.tables.map((t: { name: string }) => t.name).sort();
            expect(tableNames).toEqual(['10', '9'].sort());
            
            expect(json).toHaveBeenCalled();
            expect(io.emit).toHaveBeenCalledWith('booking-update', expect.objectContaining({ type: 'update' }));
        });
    });

    describe('cancelBooking', () => {
        it('should cancel a booking in DB', async () => {
             const existing = await prisma.booking.create({
                data: {
                    name: 'To Cancel',
                    size: 2,
                    startTime: new Date(),
                    endTime: new Date(),
                    language: 'en',
                    status: 'CONFIRMED',
                    tenantId,
                }
            });

            req = { tenant: tenant(), params: { id: existing.id } };

            await bookingController(io).cancelBooking(req as AuthRequest, res as Response);

            const dbBooking = await prisma.booking.findUnique({ where: { id: existing.id } });
            expect(dbBooking?.status).toBe('CANCELLED');
            
            expect(json).toHaveBeenCalled();
        });
        
        it('should return 404 if ID not found (scoped lookup)', async () => {
             req = { tenant: tenant(), params: { id: 'non-existent-uuid' } };

             await bookingController(io).cancelBooking(req as AuthRequest, res as Response);

             expect(status).toHaveBeenCalledWith(404);
        });
    });
});
