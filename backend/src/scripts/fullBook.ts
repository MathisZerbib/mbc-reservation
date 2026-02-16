import { prisma } from '../lib/prisma';
import { fullBook, consecutiveBook, fullBookWithConsecutive } from '../services/fullBookService';
import dayjs from 'dayjs';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));


const AUTO_BOOK_DURATION = 120;
const LAST_SEATING = '22:00';



// ── Shared CLI helpers ──────────────────────────────────────────────

async function pickDate(): Promise<string> {
    const options = Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day').format('YYYY-MM-DD'));

    console.log('\nSelect a date:');
    options.forEach((d, i) => {
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayjs(d).format('dddd');
        console.log(`[${i + 1}] ${d} (${label})`);
    });
    console.log('[8] Custom Date');

    while (true) {
        const idx = parseInt(await ask('\nEnter choice (1-8): ')) - 1;
        if (idx >= 0 && idx < 7) return options[idx];
        if (idx === 7) return ask('Enter custom date (YYYY-MM-DD): ');
        console.log('Invalid choice.');
    }
}

async function askLeaveEmpty(): Promise<number> {
    const v = await ask('How many tables should stay EMPTY? [default: 0]: ');
    return v ? parseInt(v) : 0;
}

async function askTableNames(): Promise<string[]> {
    const allTables = await prisma.table.findMany({ orderBy: { id: 'asc' } });
    console.log('\nAvailable tables:');
    console.log(allTables.map(t => `  ${t.name} (capacity: ${t.capacity})`).join('\n'));

    const input = await ask('\nEnter table number(s), comma-separated for consecutive booking (e.g. 1,5,11): ');
    return input.split(',').map(s => s.trim()).filter(Boolean);
}

async function askCount(label: string, defaultVal: number): Promise<number> {
    const v = await ask(`${label} [default: ${defaultVal}]: `);
    const n = v ? parseInt(v) : defaultVal;
    if (isNaN(n) || n < 1) throw new Error('Invalid count.');
    return n;
}

function printSlotPreview(tableName: string, start: dayjs.Dayjs, count: number, labelFn?: (i: number) => string) {
    const lastSeating = dayjs(start.format('YYYY-MM-DD') + 'T' + LAST_SEATING);
    let t = start;
    for (let i = 0; i < count; i++) {
        if (!t.isBefore(lastSeating)) {
            console.log(`    Slot #${i + 1}: ⏩ skipped (past ${LAST_SEATING})`);
            break;
        }
        const end = t.add(AUTO_BOOK_DURATION, 'minute');
        const tag = labelFn ? ` ${labelFn(i)}` : '';
        console.log(`    Slot #${i + 1}${tag}: ${t.format('HH:mm')} → ${end.format('HH:mm')}`);
        t = end;
    }
}

function printResult(result: { success: number; failed: number; details: string[] }) {
    console.log(`✅ ${result.success} | ❌ ${result.failed}`);
    result.details.forEach(msg => console.log(`  ${msg}`));
}

async function confirm(): Promise<boolean> {
    return (await ask('\nProceed? (y/n): ')).toLowerCase() === 'y';
}

// ── Modes ───────────────────────────────────────────────────────────

async function runFullBook(date: string, time: string) {
    const leaveEmpty = await askLeaveEmpty();
    const total = await prisma.table.count();
    const toBook = total - leaveEmpty;
    const start = dayjs(`${date}T${time}`);

    console.log(`\nReady to book ~${toBook} tables for:`);
    console.log(`Date: ${start.format('dddd, D MMMM YYYY')}  Time: ${start.format('HH:mm')}  Empty: ${leaveEmpty}`);

    if (!await confirm()) return console.log('Aborted.');

    console.log('\n🚀 Starting full booking...');
    const r = await fullBook(date, time, Math.max(toBook, 0));
    console.log('\n🎉 Completed!');
    printResult(r);
    console.log(`\nℹ️  Navigate to ${start.format('YYYY-MM-DD')} in dashboard.`);
}

async function runConsecutiveBook(date: string, time: string) {
    const tableNames = await askTableNames();
    if (!tableNames.length) return console.log('No tables entered. Aborted.');

    const count = await askCount('How many consecutive reservations per table?', 2);
    const guestName = (await ask('Guest name prefix [default: Auto-Consec]: ')) || 'Auto-Consec';

    const start = dayjs(`${date}T${time}`);
    const allTables = await prisma.table.findMany({ orderBy: { id: 'asc' } });

    console.log(`\n📋 Preview — ${tableNames.join(', ')} × ${count} slots from ${start.format('dddd, D MMMM YYYY HH:mm')}`);
    for (const name of tableNames) {
        const t = allTables.find(t => t.name === name);
        if (!t) continue;
        console.log(`  Table ${name} (${AUTO_BOOK_DURATION}min):`);
        printSlotPreview(name, start, count);
    }

    if (!await confirm()) return console.log('Aborted.');

    console.log('\n🚀 Creating consecutive bookings...');
    const r = await consecutiveBook(date, time, tableNames, count, guestName);
    console.log('\n🎉 Completed!');
    printResult(r);
    console.log(`\nℹ️  Navigate to ${start.format('YYYY-MM-DD')} in dashboard.`);
}

async function runFullBookWithConsecutive(date: string, time: string) {
    const leaveEmpty = await askLeaveEmpty();

    const tableNames = await askTableNames();
    if (!tableNames.length) return console.log('No tables entered. Aborted.');

    const extraSlots = await askCount('How many EXTRA consecutive slots per table? (on top of full book)', 1);
    const guestName = (await ask('Guest name prefix for consecutive slots [default: Auto-Consec]: ')) || 'Auto-Consec';

    const start = dayjs(`${date}T${time}`);
    const total = await prisma.table.count();
    const allTables = await prisma.table.findMany({ orderBy: { id: 'asc' } });

    console.log(`\n📋 Preview:`);
    console.log(`Full book: ~${total - leaveEmpty} tables at ${start.format('dddd, D MMMM YYYY HH:mm')} (${leaveEmpty} empty)`);
    console.log(`Consecutive on: [${tableNames.join(', ')}] × ${extraSlots} extra slot(s)\n`);

    for (const name of tableNames) {
        const t = allTables.find(t => t.name === name);
        if (!t) continue;
        const dur = AUTO_BOOK_DURATION;
        console.log(`  Table ${name} (${dur}min):`);
        printSlotPreview(name, start, extraSlots + 1, i => i === 0 ? '(full book)' : `(extra #${i})`);
    }

    if (!await confirm()) return console.log('Aborted.');

    console.log('\n🚀 Starting full book + consecutive...');
    const r = await fullBookWithConsecutive(date, time, leaveEmpty, tableNames, extraSlots, guestName);

    console.log('\n🎉 Completed!');
    console.log('\n📦 Full book:');
    printResult(r.full);
    console.log('\n🔗 Consecutive:');
    printResult(r.consecutive);
    console.log(`\n📊 Total: ✅ ${r.totalSuccess} | ❌ ${r.totalFailed}`);
    console.log(`\nℹ️  Navigate to ${start.format('YYYY-MM-DD')} in dashboard.`);
}

// ── Main ────────────────────────────────────────────────────────────

const MODES = [
    { key: '1', label: 'Full Book — fill all tables for a time slot', fn: runFullBook },
    { key: '2', label: 'Consecutive Book — book specific table(s) for N consecutive slots', fn: runConsecutiveBook },
    { key: '3', label: 'Full Book + Consecutive — fill all tables AND add extra consecutive slots on specific table(s)', fn: runFullBookWithConsecutive },
] as const;

async function runCli() {
    console.log('📅 Reservation Filler CLI\n');
    console.log('Select mode:');
    MODES.forEach(m => console.log(`[${m.key}] ${m.label}`));

    let mode: typeof MODES[number] | undefined;
    while (!mode) {
        const c = await ask(`\nEnter choice (1-${MODES.length}): `);
        mode = MODES.find(m => m.key === c);
        if (!mode) console.log('Invalid choice.');
    }

    const date = await pickDate();
    const time = (await ask('Enter time (HH:mm) [default: 19:00]: ')) || '19:00';

    if (!dayjs(`${date}T${time}`).isValid()) {
        console.error('❌ Invalid date/time format.');
        rl.close();
        process.exit(1);
    }

    if (time >= LAST_SEATING) {
        console.error(`❌ No reservations allowed at or after ${LAST_SEATING}.`);
        rl.close();
        process.exit(1);
    }

    try {
        await mode.fn(date, time);
    } catch (e) {
        console.error('Critical Error:', (e as Error).message);
    }

    rl.close();
}

runCli()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
