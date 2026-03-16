import { prisma } from '../lib/prisma';
import { ADJACENCY_MAP } from '../utils/adjacency';
import { CreateReservationInput } from '../types/booking';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RESTAURANT_TZ = 'Europe/Paris';

// Core booking logic and availability checks
export const LAST_SEATING = '22:00';
export const MIN_BOOKING_ADVANCE_HOURS = 2;

// Helper: Add minutes to date
export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

// Reservation duration in minutes (fixed 2 hours for all bookings)
export const RESERVATION_DURATION = 120;

export const MAX_BOOKINGS_PER_TABLE = 3;

// ──────────────────────────────────────────
// 1️⃣  AVAILABILITY — Single query, no N+1
// ──────────────────────────────────────────

/**
 * Returns all tables that have NO overlapping active bookings
 * in the [requestedStart, requestedEnd) window.
 *
 * Uses a SINGLE query for all overlapping bookings instead of
 * one query per table (eliminates N+1).
 */
export async function getAvailableTables(
    requestedStart: Date,
    requestedEnd: Date
) {
    const allTables = await prisma.table.findMany();

    // Fetch ALL overlapping bookings in one query
    const overlappingBookings = await prisma.booking.findMany({
        where: {
            status: { not: 'CANCELLED' },
            AND: [
                { startTime: { lt: requestedEnd } },
                { endTime: { gt: requestedStart } }
            ]
        },
        include: {
            tables: { select: { id: true } }
        }
    } as any);

    // Build set of occupied table IDs
    const occupiedTableIds = new Set<number>();
    for (const booking of overlappingBookings) {
        const tableIds = (booking as any).tables.map((t: any) => t.id);
        for (const id of tableIds) {
            occupiedTableIds.add(id);
        }
    }

    // O(n) filter
    const available = allTables.filter(t => !occupiedTableIds.has(t.id));
    console.log(`🔍 [getAvailableTables] Found ${available.length}/${allTables.length} tables available from ${requestedStart.toISOString()} to ${requestedEnd.toISOString()}`);
    if (available.length < 10) {
        console.log(`   Occupied IDs: ${Array.from(occupiedTableIds).join(', ')}`);
    }
    return available;
}

// ──────────────────────────────────────────
// 2️⃣  TRANSACTIONAL BOOKING CREATION
// ──────────────────────────────────────────



/**
 * Creates a booking inside a Prisma transaction.
 *
 * The availability check + table assignment + booking creation
 * all happen atomically, preventing race-condition double bookings
 * where two users check availability at the same time and both see
 * the same table as free.
 */
export async function createReservation(input: CreateReservationInput) {
    const { name, phone, email, language, size, startTime, lowTable } = input;
    const endTime = addMinutes(startTime, RESERVATION_DURATION);

    return prisma.$transaction(async (tx) => {
        // 1. Find all conflicting bookings inside the transaction
        const conflictingBookings = await tx.booking.findMany({
            where: {
                status: { not: 'CANCELLED' },
                AND: [
                    { startTime: { lt: endTime } },
                    { endTime: { gt: startTime } }
                ]
            },
            include: { tables: true }
        } as any);

        const occupiedIds = new Set<number>(
            (conflictingBookings as any[]).flatMap((b: any) =>
                b.tables.map((t: any) => t.id)
            )
        );

        const allTables = await tx.table.findMany();
        const availableTables = allTables.filter(t => !occupiedIds.has(t.id));

        // 2. Find best table combination
        console.log(`🎯 [createReservation] Attempting auto-assignment for ${size} guests (Low Table: ${lowTable}) at ${startTime.toISOString()}`);
        const combination = findTableCombination(size, availableTables);

        if (combination) {
            console.log(`✅ [createReservation] Found combination: ${combination.map((t: any) => t.name).join(', ')} (Total Capacity: ${combination.reduce((s: number, t: any) => s + t.capacity, 0)})`);
        } else {
            console.log(`❌ [createReservation] No valid combination found for ${size} guests.`);
        }

        // 3. Create booking atomically (even without tables if none found)
        const booking = await tx.booking.create({
            data: {
                name,
                phone: phone || null,
                email: email || null,
                language: language || 'fr',
                size,
                startTime,
                endTime,
                lowTable: lowTable || false,
                tables: {
                    connect: combination ? combination.map((t: any) => ({ id: t.id })) : []
                }
            }
        } as any);

        return booking;
    });
}

// ──────────────────────────────────────────
// 3️⃣  COMBINATION LOGIC — Scored optimal
// ──────────────────────────────────────────

const CLUSTERS = [
    // 1. Big Groups (11+12) - Priority for large groups
    ['11', '12'],

    // 2. Capsule Booths (20-28)
    ['20', '21', '22', '23', '24', '25', '26', '27', '28'],

    // 3. Bottom Row (30-36)
    ['30', '31', '32', '33', '34', '35', '36'],

    // 4. Top Row (1-10)
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
];

/**
 * Score a candidate combination.
 * Lower is better: penalizes capacity overflow and using many tables.
 */
function scoreCombination(tables: any[], requestedSize: number): number {
    const totalCapacity = tables.reduce((s: number, t: any) => s + t.capacity, 0);
    const overflow = totalCapacity - requestedSize;
    const tableCountPenalty = tables.length * 2;
    return overflow + tableCountPenalty;
}

/**
 * BFS within a set of available tables, starting from `seed`,
 * constrained to `allowedNames` (if provided, limits to a cluster).
 * Returns the connected combination or null if capacity < size.
 */
function bfsFromSeed(
    seed: any,
    size: number,
    tableMap: Map<string, any>,
    allowedNames?: Set<string>
): any[] | null {
    const result: any[] = [seed];
    let capacity = seed.capacity;
    const visited = new Set([seed.name]);
    const queue = [...(ADJACENCY_MAP[seed.name] || [])];

    while (queue.length > 0 && capacity < size) {
        const nextName = queue.shift();
        if (!nextName || visited.has(nextName)) continue;

        // If restricted to a cluster, skip names outside it
        if (allowedNames && !allowedNames.has(nextName)) continue;

        visited.add(nextName);

        const neighbor = tableMap.get(nextName);
        if (neighbor) {
            result.push(neighbor);
            capacity += neighbor.capacity;
            queue.push(...(ADJACENCY_MAP[nextName] || []));
        }
    }

    return capacity >= size ? result : null;
}

export function findTableCombination(size: number, availableTables: any[]) {
    // ── Step 1: Try a single table (best fit with slack limits) ──
    const single = availableTables
        .filter(t => {
            if (t.capacity < size) return false;
            // CAPACITY SLACK LIMITS:
            // - If party size is 1-2, don't auto-assign to tables of 4 or more.
            // - If party size is 3-4, don't auto-assign to tables of 6 or more.
            if (size <= 2 && t.capacity >= 4) return false;
            if (size <= 4 && t.capacity >= 6) return false;
            return true;
        })
        .sort((a, b) => a.capacity - b.capacity)[0];

    if (single) {
        console.log(`   └─ Step 1 (Single): Found table ${single.name} (Cap: ${single.capacity})`);
        return [single];
    }

    const tableMap = new Map(availableTables.map(t => [t.name, t]));

    // ── Step 2: Cluster-based scored search ──
    for (const cluster of CLUSTERS) {
        const availableInCluster = cluster.filter(name => tableMap.has(name));
        const totalCapacityInCluster = availableInCluster.reduce((sum, name) => {
            const t = tableMap.get(name);
            return sum + (t?.capacity || 0);
        }, 0);

        if (totalCapacityInCluster < size) continue;

        const clusterSet = new Set(cluster);
        const candidates: any[][] = [];

        // Try every available table in this cluster as a BFS seed
        for (const startNode of availableInCluster) {
            const seed = tableMap.get(startNode);
            if (!seed) continue;

            const combo = bfsFromSeed(seed, size, tableMap, clusterSet);
            if (combo) {
                candidates.push(combo);
            }
        }

        if (candidates.length > 0) {
            // Pick the best-scored combination in this cluster
            candidates.sort((a, b) => scoreCombination(a, size) - scoreCombination(b, size));
            console.log(`   └─ Step 2 (Cluster): Found best in cluster ${cluster.join(',')} -> ${candidates[0].map((t: any) => t.name).join(',')}`);
            return candidates[0];
        }
    }

    // ── Step 3: Global fallback — scored search across all tables ──
    const globalCandidates: any[][] = [];

    for (const seed of availableTables) {
        const combo = bfsFromSeed(seed, size, tableMap);
        if (combo) {
            globalCandidates.push(combo);
        }
    }

    if (globalCandidates.length > 0) {
        globalCandidates.sort((a, b) => scoreCombination(a, size) - scoreCombination(b, size));
        console.log(`   └─ Step 3 (Global): Found fallback combination: ${globalCandidates[0].map((t: any) => t.name).join(',')}`);
        return globalCandidates[0];
    }

    console.log(`   └─ Failed: No combination found in any step.`);

    return null;
}

// ──────────────────────────────────────────
// 4️⃣  SUGGESTION ENGINE
// ──────────────────────────────────────────

export async function getSuggestions(date: string, size: number, requestedTime: string) {
    const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
    const suggestions: string[] = [];

    // Sort slots by proximity to requested time
    const requestedMinutes = timeToMinutes(requestedTime);
    const sortedSlots = [...TIME_SLOTS].sort((a, b) => {
        return Math.abs(timeToMinutes(a) - requestedMinutes) - Math.abs(timeToMinutes(b) - requestedMinutes);
    });

    for (const slot of sortedSlots) {
        if (slot === requestedTime) continue;

        const start = dayjs.tz(`${date}T${slot}`, RESTAURANT_TZ);
        if (isNaN(start.toDate().getTime())) continue;

        // Ensure slot is at least 2 hours away
        if (start.isBefore(dayjs().add(MIN_BOOKING_ADVANCE_HOURS, 'hours'))) continue;

        const end = addMinutes(start.toDate(), RESERVATION_DURATION);


        const availableTables = await getAvailableTables(start.toDate(), end);
        const combination = findTableCombination(size, availableTables);

        if (combination) {
            suggestions.push(slot);
        }

        if (suggestions.length >= 4) break;
    }

    return suggestions.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

function timeToMinutes(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
