import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { 
    getAvailableTables, 
    findTableCombination, 
    getDuration,
    addMinutes 
} from '../services/bookingService';
import { FLOOR_PLAN_DATA, getCapacity } from '../utils/floorPlanData';

describe('Real-Life Booking Logic', () => {
    // Helper to create a booking date for "tomorrow" at a specific time
    const getTargetDate = (timeStr: string) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [hours, minutes] = timeStr.split(':').map(Number);
        tomorrow.setHours(hours, minutes, 0, 0);
        return tomorrow;
    };

    beforeAll(async () => {
        // CLEANUP
        await prisma.booking.deleteMany();
        await prisma.table.deleteMany();

        // SEED FROM FLOOR PLAN DATA
        for (const t of FLOOR_PLAN_DATA) {
            await prisma.table.create({ 
                data: { 
                    name: t.id,
                    capacity: getCapacity(t),
                    type: t.shape === 'BAR' ? 'BAR' : 'RECTANGULAR', // Mapping basic types
                    x: t.x,
                    y: t.y
                } 
            });
        }
    });

    afterAll(async () => {
        await prisma.booking.deleteMany();
        await prisma.table.deleteMany();
    });

    beforeEach(async () => {
        // Reset bookings between tests
        await prisma.booking.deleteMany();
    });

    describe('Scenario 1: Smart Assignment (Capacity Logic)', () => {
        it('should assign a small table for a couple', async () => {
            const size = 2;
            const startTime = getTargetDate('19:00');
            const endTime = addMinutes(startTime, getDuration(size));

            // Fetch availability
            const available = await getAvailableTables(startTime, endTime);
            
            // Logic being tested
            const assignment = findTableCombination(size, available);

            expect(assignment).not.toBeNull();
            expect(assignment).toHaveLength(1); 
            // Should prefer capacity 2 tables (e.g., 30, 31, 20-28) over capacity 6 (11, 12)
            expect(assignment![0].capacity).toBe(2);
        });

        it('should prioritize large tables (11/12) for large groups (6 pax)', async () => {
            const size = 6;
            const startTime = getTargetDate('19:00');
            const endTime = addMinutes(startTime, getDuration(size));
            const available = await getAvailableTables(startTime, endTime);

            const assignment = findTableCombination(size, available);
            expect(assignment).not.toBeNull();
            
            // Should pick explicit large table if avail
            const tableNames = assignment!.map(t => t.name);
            expect(tableNames.some(name => ['11', '12'].includes(name))).toBe(true);
        });
    });

    describe('Scenario 2: Table Combinations', () => {
        it('should combine tables for very large groups (12 pax)', async () => {
            const size = 12;
            const startTime = getTargetDate('20:00');
            const endTime = addMinutes(startTime, getDuration(size));

            const available = await getAvailableTables(startTime, endTime);
            const assignment = findTableCombination(size, available);

            expect(assignment).not.toBeNull();
            // Should be combination of 11+12 OR a long string of capsules
            const totalCap = assignment!.reduce((sum, t) => sum + t.capacity, 0);
            expect(totalCap).toBeGreaterThanOrEqual(12);
        });
        
        it('should combine capsule tables if large tables are taken', async () => {
             const size = 6;
             const startTime = getTargetDate('20:00');
             const endTime = addMinutes(startTime, getDuration(size));

             // Block 11 and 12
             const largeTables = await prisma.table.findMany({ where: { name: { in: ['11', '12'] } } });
             for (const t of largeTables) {
                 await prisma.booking.create({
                     data: {
                         name: 'Blocker',
                         language: 'en',
                         size: 6,
                         startTime,
                         endTime,
                         tables: { connect: { id: t.id } }
                     }
                 });
             }

             const available = await getAvailableTables(startTime, endTime);
             const assignment = findTableCombination(size, available);

             expect(assignment).not.toBeNull();
             // Should select 3 capsules (cap 2 each) => 3 tables
             expect(assignment!.length).toBeGreaterThanOrEqual(3);
             expect(assignment![0].name).toMatch(/2[0-9]/); // Should be in 20s range (capsules)
        });
    });

    describe('Scenario 3: Time Overlaps', () => {
        it('should detect unavailability correctly', async () => {
             const table1 = await prisma.table.findFirstOrThrow({ where: { name: '10' } });
             const startExisting = getTargetDate('18:00');
             const endExisting = addMinutes(startExisting, 120);

             await prisma.booking.create({
                 data: {
                     name: 'Existing',
                     language: 'en',
                     size: 4,
                     startTime: startExisting,
                     endTime: endExisting,
                     tables: { connect: { id: table1.id } }
                 }
             });

             const reqStart = getTargetDate('19:00');
             const reqEnd = addMinutes(reqStart, 120);

             const available = await getAvailableTables(reqStart, reqEnd);
             const isTable1Available = available.some(t => t.id === table1.id);
             expect(isTable1Available).toBe(false);
        });
    });
});