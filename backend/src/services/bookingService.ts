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

export function findTableCombination(size: number, availableTables: any[]) {
    // 1. Try single table first (best fit)
    const single = availableTables
        .filter(t => t.capacity >= size)
        .sort((a, b) => a.capacity - b.capacity)[0];

    if (single) return [single];

    const tableMap = new Map(availableTables.map(t => [t.name, t]));

    // 2. Check Clusters first
    for (const cluster of CLUSTERS) {
        // Find available tables within this cluster
        const availableInCluster = cluster.filter(name => tableMap.has(name));

        // Skip if not enough capacity potential
        const totalCapacityInCluster = availableInCluster.reduce((sum, name) => {
            const t = tableMap.get(name);
            return sum + (t?.capacity || 0);
        }, 0);

        if (totalCapacityInCluster < size) continue;

        // Try to find a valid connected sub-group within this cluster
        // We treat the available tables in cluster as our search space
        for (const startNode of availableInCluster) {
            const seed = tableMap.get(startNode);
            if (!seed) continue;

            let result: any[] = [seed];
            let currentCapacity = seed.capacity;
            const visited = new Set([seed.name]);
            const queue = [...(ADJACENCY_MAP[seed.name] || [])];

            while (queue.length > 0 && currentCapacity < size) {
                const nextName = queue.shift();
                if (!nextName || visited.has(nextName)) continue;

                // CRITICAL: Only consider tables IN THE CURRENT CLUSTER
                if (!cluster.includes(nextName)) continue;

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
    }

    // 3. Fallback to global greedy search (existing logic)
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
