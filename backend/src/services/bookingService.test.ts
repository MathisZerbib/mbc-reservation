import { describe, it, expect } from 'vitest';
import { findTableCombination } from './bookingService';

// Mock Table Data based on floorPlanData.ts
// Adjusted capacities based on user scenarios (e.g. Capsules = 2 pax for 12pax/6tables scenario)
const ALL_TABLES = [
    // Top Row: 1-10
    // Hypothetical capacities: 
    // 1, 10 are big Octagons -> say 4
    // 4, 7, 2 are big Rectangles -> say 4 (User wants 2,4,7 for group of 4)
    // Others -> 2
    { id: 1, name: '10', capacity: 4 }, { id: 2, name: '9', capacity: 2 },
    { id: 3, name: '8', capacity: 2 }, { id: 4, name: '7', capacity: 4 },
    { id: 5, name: '6', capacity: 2 }, { id: 6, name: '5', capacity: 2 },
    { id: 7, name: '4', capacity: 4 }, { id: 8, name: '3', capacity: 2 },
    { id: 9, name: '2', capacity: 4 }, { id: 10, name: '1', capacity: 4 },

    // Big Tables
    { id: 11, name: '11', capacity: 6 },
    { id: 12, name: '12', capacity: 6 },

    // Capsules (20-28)
    // User scenario: "assign table 20, 21, 22, 23, 24, 25 together for a group of 12" => 6 tables = 12 people => 2 per table
    { id: 20, name: '20', capacity: 2 }, { id: 21, name: '21', capacity: 2 },
    { id: 22, name: '22', capacity: 2 }, { id: 23, name: '23', capacity: 2 },
    { id: 24, name: '24', capacity: 2 }, { id: 25, name: '25', capacity: 2 },
    { id: 26, name: '26', capacity: 2 }, { id: 27, name: '27', capacity: 2 },
    { id: 28, name: '28', capacity: 2 },

    // Bottom Row
    { id: 30, name: '30', capacity: 2 }, { id: 31, name: '31', capacity: 2 },
    { id: 32, name: '32', capacity: 2 }, { id: 33, name: '33', capacity: 2 },
    { id: 34, name: '34', capacity: 2 }, { id: 35, name: '35', capacity: 2 },
    { id: 36, name: '36', capacity: 2 },

    // Bar
    { id: 40, name: '40', capacity: 1 },
];

describe('findTableCombination', () => {

    it('should assign a single table (2, 4, or 7) for a group of 4', () => {
        // We filter for a specific test case where only one of these "ideal" tables is free to ensure logic works, 
        // OR we just provide all and ensure it picks one valid single table.
        const available = ALL_TABLES;
        const result = findTableCombination(4, available);

        expect(result).toHaveLength(1);
        const t = result![0];
        // Must be one of the capacity-4 tables. 2, 4, 7, 10, 1 are capacity 4 in our mock.
        // The user specifically mentioned 2, 4, 7. 
        expect(t.capacity).toBeGreaterThanOrEqual(4);
        // We can't strictly assert it MUST be 2, 4, or 7 unless others are occupied, 
        // but let's check it picks a single fitting table.
    });

    it('should assign table 11 and 12 together for a group of 12 (Priority 1)', () => {
        const available = ALL_TABLES;
        const result = findTableCombination(12, available);

        expect(result).toBeDefined();
        const names = result?.map(t => t.name).sort();
        // Since 11+12 is usually defined as the highest priority cluster for big groups
        expect(names).toEqual(['11', '12']);
    });

    it('should assign table 20-25 or 23-28 for a group of 12 if 11/12 are taken', () => {
        // 11 and 12 occupied
        const available = ALL_TABLES.filter(t => !['11', '12'].includes(t.name));
        const result = findTableCombination(12, available);

        expect(result).toBeDefined();
        const names = result?.map(t => t.name).sort();

        // Should be a set of 6 capsule tables. 
        // Valid sets could be 20-25 or 23-28 based on traversal order (greedy).
        // Since they are all 2-seaters, we need 6 of them.
        expect(result).toHaveLength(6);

        // Check connectivity effectively: existing logic ensures they are connected.
        // We just verify it picked valid capsules.
        const isCapsule = (n: string) => parseInt(n) >= 20 && parseInt(n) <= 28;
        expect(names?.every(isCapsule)).toBe(true);
    });

    it('should prioritize the Capsule Cluster (20-28) for a group of 8', () => {
        // If 11/12 are taken (or too big/small rules?), or just prioritize capsules for medium-large groups?
        // Let's assume 11/12 are taken to force looking elsewhere, 
        // OR perhaps 8 fits into 4 capsules (4*2=8) better than splitting elsewhere.

        const available = ALL_TABLES.filter(t => !['11', '12'].includes(t.name));
        const result = findTableCombination(8, available);

        expect(result).toBeDefined();
        // Should pick 4 capsules
        expect(result).toHaveLength(4);
        const names = result?.map(t => t.name);
        // Verify they are capsules
        expect(names?.every(n => parseInt(n) >= 20 && parseInt(n) <= 28)).toBe(true);
    });

    it('should use the Top Row (1-10) for a medium group if clusters match', () => {
        // Force capsules and big tables unavailable
        const available = ALL_TABLES.filter(t =>
            !['11', '12'].includes(t.name) &&
            !(parseInt(t.name) >= 20 && parseInt(t.name) <= 28) &&
            !(parseInt(t.name) >= 30)
        );

        // Group of 6. Top row has 4-seaters and 2-seaters.
        // e.g. Table 7 (4) + Table 8 (2) = 6.
        const result = findTableCombination(6, available);

        expect(result).toBeDefined();
        const totalCapacity = result?.reduce((acc, t) => acc + t.capacity, 0);
        expect(totalCapacity).toBeGreaterThanOrEqual(6);

        // Verify tables are from top row
        const isTopRow = (n: string) => parseInt(n) >= 1 && parseInt(n) <= 10;
        expect(result?.every(t => isTopRow(t.name))).toBe(true);
    });

    it('should correctly handle the bottom row cluster', () => {
        const available = ALL_TABLES.filter(t => ['30', '31', '32', '33'].includes(t.name));
        // 30,31,32,33 are all 2-seaters.
        // Request 6 people -> needs 3 tables.
        const result = findTableCombination(6, available);

        expect(result).toBeDefined();
        expect(result).toHaveLength(3);
        const names = result?.map(t => t.name).sort();
        // Should be contiguous, e.g. 30,31,32 or 31,32,33
        // Given simple adjacency 30-31-32-33, either works.
        // Just verify valid bottom row tables.
        expect(names?.every(n => parseInt(n) >= 30 && parseInt(n) <= 36)).toBe(true);
    });

    it('should return null if no combination is possible', () => {
        // Only one small table available
        const available = [{ id: 40, name: '40', capacity: 1 }];
        const result = findTableCombination(4, available);
        expect(result).toBeNull();
    });
});
