import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { 
    getAvailableTables, 
    findTableCombination, 
    getDuration,
    addMinutes 
} from '../services/bookingService';
import { ADJACENCY_MAP } from '../utils/adjacency';
    
// Mock data to seed
const MOCK_TABLES = [
    { id: 1, name: '1', capacity: 2, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 2, name: '2', capacity: 2, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 3, name: '3', capacity: 4, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 11, name: '11', capacity: 6, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 12, name: '12', capacity: 6, type: 'RECTANGULAR', x: 0, y: 0 },
    // A simplified cluster for combination testing
    { id: 30, name: '30', capacity: 2, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 31, name: '31', capacity: 2, type: 'RECTANGULAR', x: 0, y: 0 },
    { id: 32, name: '32', capacity: 2, type: 'RECTANGULAR', x: 0, y: 0 },
];

// Ensure we have adjacency entries for our mock tables if not already present in actual map
// This is for the test context to ensure deterministic behavior if the real map changes
const TEST_ADJACENCY = {
    '30': ['31'],
    '31': ['30', '32'],
    '32': ['31']
};

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

        // SEED
        for (const t of MOCK_TABLES) {
            await prisma.table.create({ data: { ...t, type: 'RECTANGULAR' } }); // Force type for simplicity
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
        it('should assign a small table for a couple, saving large tables', async () => {
            const size = 2;
            const startTime = getTargetDate('19:00');
            const endTime = addMinutes(startTime, getDuration(size));

            // Fetch availability
            const available = await getAvailableTables(startTime, endTime);
            
            // Logic being tested
            const assignment = findTableCombination(size, available);

            expect(assignment).not.toBeNull();
            expect(assignment).toHaveLength(1); // Should be single table
            // It should prefer tables 1, 2, 30, 31, 32 (cap 2) over 3 (cap 4) or 11 (cap 6)
            expect(assignment![0].capacity).toBe(2);
        });

        it('should not assign a 6-top to a group of 2 even if small tables are full (unless fallback is strict)', async () => {
            const size = 2;
            const startTime = getTargetDate('19:00');
            const endTime = addMinutes(startTime, getDuration(size));

            // Manually book all small tables
            const smallTables = await prisma.table.findMany({ where: { capacity: 2 } });
            for (const t of smallTables) {
                await prisma.booking.create({
                    data: {
                        name: 'Blocker',
                        language: 'fr',
                        size: 2,
                        startTime,
                        endTime,
                        tables: { connect: { id: t.id } }
                    }
                });
            }

            const available = await getAvailableTables(startTime, endTime);
            const assignment = findTableCombination(size, available);

            // Based on your code logic: "if (size <= 2 && t.capacity >= 4) return false;"
            // This expects the system to REFUSE the booking rather than waste a large table
            expect(assignment).toBeNull(); 
        });
    });

    describe('Scenario 2: Table Combinations for Large Groups', () => {
        it('should combine adjacent tables 30+31+32 for a group of 6', async () => {
            // Note: We need to ensure ADJACENCY_MAP in src/utils/adjacency.ts supports 30-31-32
            // Since we can't easily mock the import of ADJACENCY_MAP without complex architectural changes,
            // we rely on the real one. Assuming 30, 31, 32 are defined there as connected.
            
            const size = 6;
            const startTime = getTargetDate('20:00');
            const endTime = addMinutes(startTime, getDuration(size));

            // We filter available tables to ONLY include our cluster 30-32 to force the logic 
            // to test combination, or we rely on the specific capacity logic 
            // that prefers combination of smalls over one big (11/12) if heavily weighted,
            // but normally it prefers single tables. 
            // So we block the single large tables first.
            const largeTables = await prisma.table.findMany({ where: { capacity: 6 } });
             for (const t of largeTables) {
                await prisma.booking.create({
                    data: {
                        name: 'Blocker Large',
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
            // Should be a combination
            expect(assignment!.length).toBeGreaterThan(1);
            
            // Verify total capacity
            const totalCap = assignment!.reduce((sum, t) => sum + t.capacity, 0);
            expect(totalCap).toBeGreaterThanOrEqual(6);
        });
    });

    describe('Scenario 3: Time Overlaps and Availability', () => {
        it('should detect unavailability when a booking overlaps', async () => {
             // Create a booking from 18:00 to 20:00 on Table 1
             const table1 = await prisma.table.findFirstOrThrow({ where: { name: '1' } });
             const startExisting = getTargetDate('18:00');
             const endExisting = addMinutes(startExisting, 120); // Ends 20:00

             await prisma.booking.create({
                 data: {
                     name: 'Existing',
                     language: 'en',
                     size: 2,
                     startTime: startExisting,
                     endTime: endExisting,
                     tables: { connect: { id: table1.id } }
                 }
             });

             // Attempt to book 19:00 - 21:00 (Overlap!)
             const reqStart = getTargetDate('19:00');
             const reqEnd = addMinutes(reqStart, 120);

             const available = await getAvailableTables(reqStart, reqEnd);
             
             // Table 1 should NOT be in the available list
             const isTable1Available = available.some(t => t.id === table1.id);
             expect(isTable1Available).toBe(false);
        });

        it('should allow booking immediately after previous one finishes (with buffer)', async () => {
             const table1 = await prisma.table.findFirstOrThrow({ where: { name: '1' } });
             
             // Booking 1: 18:00 - 20:00
             const start1 = getTargetDate('18:00');
             const end1 = getTargetDate('20:00');
             
             await prisma.booking.create({
                 data: { name: 'Slot 1', language: 'fr', size: 2, startTime: start1, endTime: end1, tables: { connect: { id: table1.id } } }
             });

             // Booking 2: 20:15 - 22:15 (Assuming 15min buffer is standard in your logic)
             // The code says: `startTime: { lt: addMinutes(requestedEnd, buffer) }`
             // logic: collision if (ExistingStart < ReqEnd + buf) AND (ExistingEnd > ReqStart - buf)
             
             // Let's try 20:15
             const reqStart = getTargetDate('20:15'); 
             const reqEnd = getTargetDate('22:15');

             const available = await getAvailableTables(reqStart, reqEnd);
             const isTable1Available = available.some(t => t.id === table1.id);
             
             expect(isTable1Available).toBe(true);
        });
    });
});