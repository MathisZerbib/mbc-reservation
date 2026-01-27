import { prisma } from '../lib/prisma';
import { ADJACENCY_MAP } from '../utils/adjacency';

// Helper: Add minutes to date
export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

export async function getAvailableTables(requestedStart: Date, requestedEnd: Date) {
    const buffer = 15;
    const allTables = await prisma.table.findMany();
    const availableTables = [];

    for (const table of allTables) {
        const collisions = await prisma.booking.findMany({
            where: {
                tables: { some: { id: table.id } },
                status: { not: 'CANCELLED' },
                AND: [
                    { startTime: { lt: addMinutes(requestedEnd, buffer) } },
                    { endTime: { gt: addMinutes(requestedStart, -buffer) } }
                ]
            } as any
        });
        if (collisions.length === 0) {
            availableTables.push(table);
        }
    }
    return availableTables;
}

export function findTableCombination(size: number, availableTables: any[]) {
    // 1. Try single table first (best fit)
    const single = availableTables
        .filter(t => t.capacity >= size)
        .sort((a, b) => a.capacity - b.capacity)[0];

    if (single) return [single];

    // 2. Greedy search for adjacent tables
    const tableMap = new Map(availableTables.map(t => [t.name, t]));

    for (const seed of availableTables) {
        let result: any[] = [seed];
        let currentCapacity = seed.capacity;

        const queue = [...(ADJACENCY_MAP[seed.name] || [])];
        const visited = new Set([seed.name]);

        while (queue.length > 0 && currentCapacity < size) {
            const nextName = queue.shift();
            if (!nextName || visited.has(nextName)) continue;
            visited.add(nextName);

            const neighbor = tableMap.get(nextName);
            if (neighbor) {
                result.push(neighbor);
                currentCapacity += neighbor.capacity;
                queue.push(...(ADJACENCY_MAP[nextName] || []));
            }
        }

        if (currentCapacity >= size) {
            return result;
        }
    }

    return null;
}
