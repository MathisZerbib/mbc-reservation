import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';

const LAST_SEATING = '22:00';
const AUTO_BOOK_DURATION = 120; // 2 hours for all auto-generated bookings

interface BookResult {
    success: number;
    failed: number;
    details: string[];
}

/**
 * Core: create N consecutive bookings on given tables starting at a given time.
 */
async function bookTables(
    tables: { id: number; name: string; capacity: number }[],
    start: dayjs.Dayjs,
    slots: number,
    namePrefix: string
): Promise<BookResult> {
    const result: BookResult = { success: 0, failed: 0, details: [] };
    const lastSeating = dayjs(start.format('YYYY-MM-DD') + 'T' + LAST_SEATING);

    for (const table of tables) {
        let slotStart = start;
        const duration = AUTO_BOOK_DURATION;

        for (let i = 0; i < slots; i++) {
            // Stop if this slot starts at or after last seating
            if (!slotStart.isBefore(lastSeating)) {
                result.details.push(`⏩ Table ${table.name} #${i + 1}: skipped (at or past last seating ${LAST_SEATING})`);
                break;
            }

            // Clamp end time to last seating + duration (don't let it run wild)
            const slotEnd = slotStart.add(duration, 'minute');
            const label = `${namePrefix}: ${table.name}${slots > 1 ? ` #${i + 1}` : ''}`;

            try {
                await prisma.booking.create({
                    data: {
                        name: label,
                        email: `auto-${table.name}${slots > 1 ? `-${i + 1}` : ''}@example.com`,
                        phone: '0000000000',
                        size: table.capacity,
                        startTime: slotStart.toDate(),
                        endTime: slotEnd.toDate(),
                        status: 'CONFIRMED',
                        language: 'en',
                        tables: { connect: [{ id: table.id }] }
                    }
                });
                result.success++;
                if (slots > 1) {
                    result.details.push(`✅ Table ${table.name} #${i + 1}: ${slotStart.format('HH:mm')} → ${slotEnd.format('HH:mm')}`);
                }
            } catch (e) {
                result.failed++;
                result.details.push(`❌ Table ${table.name}${slots > 1 ? ` #${i + 1}` : ''}: ${(e as Error).message.split('\n')[0]}`);
            }

            slotStart = slotEnd;
        }
    }
    return result;
}

function parseStart(date: string, time: string): dayjs.Dayjs {
    const start = dayjs(`${date}T${time}`);
    if (!start.isValid()) throw new Error('Invalid date/time format.');
    const lastSeating = dayjs(`${date}T${LAST_SEATING}`);
    if (!start.isBefore(lastSeating)) {
        throw new Error(`No reservations allowed at or after ${LAST_SEATING}.`);
    }
    return start;
}

async function resolveTables(names: string[]) {
    const tables = await prisma.table.findMany({ where: { name: { in: names } } });
    const found = new Set(tables.map(t => t.name));
    const missing = names.filter(n => !found.has(n));
    if (missing.length) throw new Error(`Tables not found: ${missing.join(', ')}`);
    return tables;
}

/**
 * Fill all (or limited) tables with a single booking each.
 */
export async function fullBook(date: string, time: string = '19:00', limit?: number) {
    const start = parseStart(date, time);
    let tables = await prisma.table.findMany({ orderBy: { id: 'asc' } });
    if (limit) tables = tables.slice(0, limit);
    return bookTables(tables, start, 1, 'Auto');
}

/**
 * Book specific tables for N consecutive back-to-back slots.
 */
export async function consecutiveBook(
    date: string,
    time: string,
    tableNames: string[],
    count: number,
    guestName: string = 'Auto-Consec'
) {
    const start = parseStart(date, time);
    const tables = await resolveTables(tableNames);
    return bookTables(tables, start, count, guestName);
}

/**
 * Full book all tables + add extra consecutive slots on specific tables.
 */
export async function fullBookWithConsecutive(
    date: string,
    time: string,
    leaveEmpty: number,
    consecutiveTableNames: string[],
    extraSlots: number,
    guestName: string = 'Auto-Consec'
) {
    const start = parseStart(date, time);

    // Step 1: full book
    const allTables = await prisma.table.findMany({ orderBy: { id: 'asc' } });
    const limit = Math.max(allTables.length - leaveEmpty, 0);
    const full = await bookTables(allTables.slice(0, limit), start, 1, 'Auto');

    // Step 2: consecutive extras on selected tables (starting after the first slot)
    const selectedTables = await resolveTables(consecutiveTableNames);
    const consec: BookResult = { success: 0, failed: 0, details: [] };

    for (const table of selectedTables) {
        const afterFirst = start.add(AUTO_BOOK_DURATION, 'minute');
        const r = await bookTables([table], afterFirst, extraSlots, guestName);
        consec.success += r.success;
        consec.failed += r.failed;
        consec.details.push(...r.details);
    }

    return {
        full,
        consecutive: consec,
        totalSuccess: full.success + consec.success,
        totalFailed: full.failed + consec.failed
    };
}
