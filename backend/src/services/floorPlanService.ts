import { prisma } from '../lib/prisma';
import { ADJACENCY_MAP as FALLBACK_ADJACENCY_MAP } from '../utils/adjacency';

export type AdjacencyMap = Record<string, string[]>;

export interface LayoutTableInput {
    id?: number;
    name: string;
    capacity: number;
    type: string;
    x: number | null;
    y: number | null;
    width: number;
    height: number;
    rotation: number;
    /** Names of adjacent tables (undirected edges, edited manually). */
    adjacentNames: string[];
}

export interface LayoutTableDTO extends Omit<LayoutTableInput, 'id' | 'adjacentNames'> {
    id: number;
    adjacentNames: string[];
}

const TABLE_TYPES = ['RECTANGULAR', 'OCTAGONAL', 'CAPSULE', 'ROUND', 'SQUARE', 'BAR'] as const;

// Canvas bounds (editor canvas is 1000x800; allow margin for flexibility).
const MAX_X = 2000;
const MAX_Y = 2000;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Pure validation/normalization of one layout row.
 * Throws with a human-readable message; controller maps to 400.
 */
export function parseLayoutTable(input: any): LayoutTableInput {
    const name = String(input?.name ?? '').trim().substring(0, 20);
    if (name.length < 1) throw new Error('Table name is required');

    const capacity = Number(input?.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
        throw new Error(`Table "${name}": capacity must be an integer between 1 and 50`);
    }

    const type = String(input?.type ?? 'RECTANGULAR');
    if (!(TABLE_TYPES as readonly string[]).includes(type)) {
        throw new Error(`Table "${name}": unknown type "${type}"`);
    }

    const numOrNull = (v: unknown, field: string): number | null => {
        if (v === null || v === undefined) return null;
        if (!isFiniteNumber(v)) throw new Error(`Table "${name}": ${field} must be a number`);
        return v;
    };
    const num = (v: unknown, field: string, min: number, max: number): number => {
        if (!isFiniteNumber(v)) throw new Error(`Table "${name}": ${field} must be a number`);
        if (v < min || v > max) throw new Error(`Table "${name}": ${field} out of range`);
        return v;
    };

    const x = numOrNull(input?.x, 'x');
    const y = numOrNull(input?.y, 'y');
    if (x !== null && (x < 0 || x > MAX_X)) throw new Error(`Table "${name}": x out of range`);
    if (y !== null && (y < 0 || y > MAX_Y)) throw new Error(`Table "${name}": y out of range`);

    const rawAdjacent: unknown[] = Array.isArray(input?.adjacentNames) ? input.adjacentNames : [];
    const adjacentNames: string[] = [...new Set(
        rawAdjacent.map(n => String(n).trim()).filter(n => n.length > 0),
    )].slice(0, 50);

    return {
        // Only positive integers reference real rows (autoincrement ids).
        // Non-positive ids are client-side temp ids for new tables → treat as absent.
        ...(Number.isInteger(input?.id) && (input.id as number) > 0 ? { id: input.id } : {}),
        name,
        capacity,
        type,
        x,
        y,
        width: num(input?.width ?? 60, 'width', 10, MAX_X),
        height: num(input?.height ?? 60, 'height', 10, MAX_Y),
        rotation: num(input?.rotation ?? 0, 'rotation', -360, 360),
        adjacentNames: adjacentNames.filter(n => n !== name),
    };
}

/**
 * Pure builder: undirected name-keyed adjacency from link rows + table id→name map.
 * Unions both directions so editors only need to store one edge per pair.
 */
export function buildAdjacencyMap(
    tables: { id: number; name: string }[],
    links: { aId: number; bId: number }[],
): AdjacencyMap {
    const nameById = new Map(tables.map(t => [t.id, t.name]));
    const map: AdjacencyMap = {};
    for (const t of tables) map[t.name] = [];
    for (const link of links) {
        const a = nameById.get(link.aId);
        const b = nameById.get(link.bId);
        if (!a || !b) continue;
        if (!map[a].includes(b)) map[a].push(b);
        if (!map[b].includes(a)) map[b].push(a);
    }
    return map;
}

/**
 * Adjacency used by auto-assignment. DB edges win; the shipped hardcoded map
 * is the fallback until the tenant saves their first layout.
 */
export async function getAdjacencyMap(tenantId: string): Promise<AdjacencyMap> {
    const [tables, links] = await Promise.all([
        prisma.table.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        prisma.tableLink.findMany({
            where: { a: { tenantId } },
            select: { aId: true, bId: true },
        }),
    ]);
    if (links.length === 0) return FALLBACK_ADJACENCY_MAP;
    return buildAdjacencyMap(tables, links);
}

/** Full layout for the editor and map rendering (geometry + adjacency). */
export async function getLayout(tenantId: string): Promise<LayoutTableDTO[]> {
    const [tables, links] = await Promise.all([
        prisma.table.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        prisma.tableLink.findMany({ where: { a: { tenantId } } }),
    ]);
    const adjacency = buildAdjacencyMap(tables, links);
    return tables.map(t => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        type: t.type,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        adjacentNames: adjacency[t.name] ?? [],
    }));
}

/**
 * Replaces the full layout atomically: upserts tables (by id, else by name),
 * deletes tables listed in `deleteIds`, then rebuilds all adjacency edges
 * from the payload. The editor always sends complete state, so full replace
 * keeps DB and UI trivially in sync (single-admin YAGNI).
 */
export async function saveLayout(rawTables: unknown[], rawDeleteIds: unknown[] = [], tenantId: string): Promise<LayoutTableDTO[]> {
    const tables = rawTables.map(parseLayoutTable);

    // Duplicate names within the payload would violate the unique constraint.
    const seen = new Set<string>();
    for (const t of tables) {
        if (seen.has(t.name)) throw new Error(`Duplicate table name: "${t.name}"`);
        seen.add(t.name);
    }

    const deleteIds = [...new Set((Array.isArray(rawDeleteIds) ? rawDeleteIds : []).filter(isFiniteNumber))];
    // Refuse to delete a table referenced by the payload itself.
    const payloadIds = new Set(tables.filter(t => t.id !== undefined).map(t => t.id as number));
    const conflicting = deleteIds.filter(id => payloadIds.has(id));
    if (conflicting.length > 0) throw new Error('Cannot delete tables that are also in the layout payload');

    // Guard: no deletion of tables with upcoming active bookings.
    if (deleteIds.length > 0) {
        const now = new Date();
        const blockers = await prisma.booking.findMany({
            where: {
                tenantId,
                status: { not: 'CANCELLED' },
                endTime: { gt: now },
                tables: { some: { id: { in: deleteIds } } },
            },
            select: { id: true },
            take: 1,
        });
        if (blockers.length > 0) {
            throw new Error('Cannot delete tables with upcoming bookings. Reassign those bookings first.');
        }
    }

    // NOTE: upserts run OUTSIDE the interactive transaction on purpose — an
    // interactive tx pins a single pooled connection, so per-row queries
    // serialize and blow the tx timeout over high-latency links. Rows are
    // independent (payload names are pre-validated unique), the pool executes
    // them concurrently, and only the edge rebuild below needs atomicity.
    if (deleteIds.length > 0) {
        await prisma.table.deleteMany({ where: { id: { in: deleteIds }, tenantId } });
    }

    const tableData = (t: LayoutTableInput) => ({
        name: t.name,
        capacity: t.capacity,
        type: t.type as any,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
    });

    const upsertRow = async (t: LayoutTableInput): Promise<[string, number]> => {
        if (t.id !== undefined) {
            // Id-path must resolve inside the tenant — never touch foreign rows.
            const existing = await prisma.table.findFirst({ where: { id: t.id, tenantId } });
            if (!existing) throw new Error(`Table id ${t.id} not found`);
            if (t.name !== existing.name) {
                const clash = await prisma.table.findUnique({
                    where: { tenantId_name: { tenantId, name: t.name } },
                });
                if (clash) throw new Error(`Duplicate table name: "${t.name}"`);
            }
            const row = await prisma.table.update({ where: { id: t.id }, data: tableData(t) });
            return [t.name, row.id];
        }
        const row = await prisma.table.upsert({
            where: { tenantId_name: { tenantId, name: t.name } },
            update: tableData(t),
            create: { ...tableData(t), tenantId },
        });
        return [t.name, row.id];
    };

    const idByName = new Map<string, number>(await Promise.all(tables.map(upsertRow)));

    // Rebuild edges from payload (canonical aId < bId, deduped) atomically.
    const seenEdges = new Set<string>();
    const edges: { aId: number; bId: number }[] = [];
    for (const t of tables) {
        const aId = idByName.get(t.name);
        if (aId === undefined) continue;
        for (const neighbor of t.adjacentNames) {
            const bId = idByName.get(neighbor);
            if (bId === undefined || bId === aId) continue;
            const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
            const key = `${lo}-${hi}`;
            if (seenEdges.has(key)) continue;
            seenEdges.add(key);
            edges.push({ aId: lo, bId: hi });
        }
    }
    await prisma.$transaction([
        prisma.tableLink.deleteMany({ where: { aId: { in: [...idByName.values()] } } }),
        ...(edges.length > 0 ? [prisma.tableLink.createMany({ data: edges })] : []),
    ]);

    return getLayout(tenantId);
}

/** Deletes a single table (guarded against upcoming bookings). */
export async function deleteTable(id: number, tenantId: string): Promise<void> {
    if (!Number.isInteger(id)) throw new Error('Invalid table id');
    const existing = await prisma.table.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Invalid table id');
    const now = new Date();
    const blockers = await prisma.booking.findMany({
        where: {
            tenantId,
            status: { not: 'CANCELLED' },
            endTime: { gt: now },
            tables: { some: { id } },
        },
        select: { id: true },
        take: 1,
    });
    if (blockers.length > 0) {
        throw new Error('Cannot delete tables with upcoming bookings. Reassign those bookings first.');
    }
    await prisma.table.delete({ where: { id } });
}
