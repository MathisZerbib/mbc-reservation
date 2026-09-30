import { prisma } from '../lib/prisma';
import { ADJACENCY_MAP } from '../utils/adjacency';
import { getAdjacencyMap, type AdjacencyMap } from './floorPlanService';
import { CreateReservationInput, BOOKING_TAGS } from '../types/booking';
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

/** Keep only known staff tags (UI sends a closed set). */
export function sanitizeTags(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const allowed = new Set<string>(BOOKING_TAGS as readonly string[]);
    return [...new Set(input.filter(t => typeof t === 'string').map(t => t.toUpperCase()))]
        .filter(t => allowed.has(t));
}

/** Buffer applied around the target window when checking kept tables. */
export const RESCHEDULE_BUFFER_MINUTES = 15;

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
    requestedEnd: Date,
    tenantId: string
) {
    const allTables = await prisma.table.findMany({ where: { tenantId } });

    // Fetch ALL overlapping bookings in one query
    const overlappingBookings = await prisma.booking.findMany({
        where: {
            tenantId,
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
    const { name, phone, email, language, size, startTime, lowTable, tenantId } = input;
    const tags = sanitizeTags(input.tags);
    const endTime = addMinutes(startTime, RESERVATION_DURATION);
    const adjacency = await getAdjacencyMap(tenantId);

    return prisma.$transaction(async (tx) => {
        // 1. Find all conflicting bookings inside the transaction
        const conflictingBookings = await tx.booking.findMany({
            where: {
                tenantId,
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

        const allTables = await tx.table.findMany({ where: { tenantId } });
        const availableTables = allTables.filter(t => !occupiedIds.has(t.id));

        // 2. Find best table combination
        console.log(`🎯 [createReservation] Attempting auto-assignment for ${size} guests (Low Table: ${lowTable}) at ${startTime.toISOString()}`);
        const combination = findTableCombination(size, availableTables, adjacency);

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
                tags,
                tenantId,
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
    adjacency: AdjacencyMap,
    allowedNames?: Set<string>
): any[] | null {
    const result: any[] = [seed];
    let capacity = seed.capacity;
    const visited = new Set([seed.name]);
    const queue = [...(adjacency[seed.name] || [])];

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
            queue.push(...(adjacency[nextName] || []));
        }
    }

    return capacity >= size ? result : null;
}

export function findTableCombination(size: number, availableTables: any[], adjacency: AdjacencyMap = ADJACENCY_MAP) {
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

            const combo = bfsFromSeed(seed, size, tableMap, adjacency, clusterSet);
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
        const combo = bfsFromSeed(seed, size, tableMap, adjacency);
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

export async function getSuggestions(date: string, size: number, requestedTime: string, tenantId: string) {
    const TIME_SLOTS = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
    const suggestions: string[] = [];
    const adjacency = await getAdjacencyMap(tenantId);

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


        const availableTables = await getAvailableTables(start.toDate(), end, tenantId);
        const combination = findTableCombination(size, availableTables, adjacency);

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

// ──────────────────────────────────────────
// 4️⃣  RESCHEDULE — move a booking, keep tables when compatible
// ──────────────────────────────────────────

export interface RescheduleInput {
    bookingId: string;
    tenantId: string;
    /** New start (date and/or hour). End is recomputed (+2h). */
    startTime?: Date;
    size?: number;
    /** Explicit table names (e.g. host accepted the suggested combination). */
    tableNames?: string[];
}

export type RescheduleResult =
    | { booking: any }
    | { conflict: true; suggestion: string[] };

/**
 * Pure kept-tables decision: enough capacity for the new size and every
 * kept table still has overlap headroom in the target window.
 * Unseated bookings trivially fit (they stay unseated).
 */
export function evaluateRescheduleFit(
    candidateRows: { id: number; capacity: number }[],
    counts: Map<number, number>,
    newSize: number,
    staysUnseated: boolean,
): boolean {
    if (staysUnseated) return true;
    const capacity = candidateRows.reduce((s, t) => s + t.capacity, 0);
    return (
        capacity >= newSize &&
        candidateRows.every(t => (counts.get(t.id) ?? 0) < MAX_BOOKINGS_PER_TABLE)
    );
}

/**
 * Moves a booking to a new time/size, keeping its tables when they still
 * fit (capacity + overlap headroom in the buffered window).
 *
 * Without explicit `tableNames`: incompatible kept tables yield
 * `{ conflict: true, suggestion }` (controller maps to 409) instead of
 * silently dropping the seating. Unseated bookings stay unseated.
 */
export async function rescheduleBooking(input: RescheduleInput): Promise<RescheduleResult> {
    const { bookingId, tenantId } = input;
    const existing = (await prisma.booking.findFirst({
        where: { id: bookingId, tenantId },
        include: { tables: true },
    } as any)) as any;
    if (!existing) throw new Error('Booking not found');
    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
        throw new Error('Cannot reschedule a closed booking');
    }

    let newSize: number = existing.size;
    if (input.size !== undefined) {
        const s = typeof input.size === 'string' ? Number(input.size) : input.size;
        if (!Number.isInteger(s) || s < 1 || s > 100) throw new Error('Invalid guest size');
        newSize = s;
    }
    let newStart: Date = existing.startTime;
    if (input.startTime !== undefined) {
        const d = input.startTime instanceof Date ? input.startTime : new Date(input.startTime as unknown as string);
        if (isNaN(d.getTime())) throw new Error('Invalid date/time');
        newStart = d;
    }
    if (input.startTime === undefined && input.size === undefined && input.tableNames === undefined) {
        throw new Error('Nothing to reschedule');
    }
    const newEnd = addMinutes(newStart, RESERVATION_DURATION);

    // Candidate tables: explicit override, else currently assigned.
    let candidateNames: string[];
    if (input.tableNames !== undefined) {
        candidateNames = input.tableNames;
        const rows = await prisma.table.findMany({ where: { tenantId, name: { in: candidateNames } } });
        const found = new Set(rows.map(r => r.name));
        const unknown = candidateNames.filter(n => !found.has(n));
        if (unknown.length > 0) throw new Error(`Unknown tables: ${unknown.join(', ')}`);
    } else {
        candidateNames = ((existing.tables ?? []) as any[]).map((t: any) => t.name);
    }
    const staysUnseated = candidateNames.length === 0 && input.tableNames === undefined;

    const bufStart = addMinutes(newStart, -RESCHEDULE_BUFFER_MINUTES);
    const bufEnd = addMinutes(newEnd, RESCHEDULE_BUFFER_MINUTES);

    return prisma.$transaction(async (tx) => {
        // Overlap counts per table in the buffered window, excluding self.
        const overlapping = (await tx.booking.findMany({
            where: {
                tenantId,
                status: { not: 'CANCELLED' },
                id: { not: bookingId },
                AND: [{ startTime: { lt: bufEnd } }, { endTime: { gt: bufStart } }],
            },
            include: { tables: { select: { id: true } } },
        } as any)) as any[];

        const counts = new Map<number, number>();
        for (const b of overlapping) {
            for (const t of (b.tables ?? []) as any[]) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
        }

        const allTables = await tx.table.findMany({ where: { tenantId } });
        const byName = new Map(allTables.map(t => [t.name, t]));
        const candidateRows = candidateNames.map(n => byName.get(n)).filter(Boolean) as any[];
        const fits = evaluateRescheduleFit(candidateRows, counts, newSize, staysUnseated);

        if (!fits && input.tableNames === undefined) {
            const adjacency = await getAdjacencyMap(tenantId);
            const available = allTables.filter(t => (counts.get(t.id) ?? 0) < MAX_BOOKINGS_PER_TABLE);
            const suggestion = findTableCombination(newSize, available, adjacency);
            return { conflict: true, suggestion: suggestion ? suggestion.map((t: any) => t.name) : [] };
        }
        if (!fits) {
            throw new Error('Tables are not available in the new time window');
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
                size: newSize,
                startTime: newStart,
                endTime: newEnd,
                tables: { set: [], connect: candidateRows.map(t => ({ id: t.id })) },
            },
        } as any);
        return { booking: updated };
    });
}
