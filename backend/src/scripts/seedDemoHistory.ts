import 'dotenv/config';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { FLOOR_PLAN_DATA, getCapacity } from '../utils/floorPlanData';

/**
 * Demo history seed: one credible year for the `demo` sandbox tenant.
 *
 * - 365 trailing days (COMPLETED + seatedAt/leftAt, ~4% no-show, ~3% host-cancel)
 *   + 14 future days (CONFIRMED/PENDING) so Live/Planning are alive.
 * - Weekly rhythm (Fri/Sat rush, Sun lunch, Mon almost closed), seasons
 *   (August dip, December peak), lunch/dinner slots, French guest pool with
 *   regulars, tags + notes, ~20% walk-ins.
 * - Occupancy is CAPPED per slot (70% past, 50% future, always ≥3 tables
 *   free) so the public widget stays bookable on demo dates.
 * - Deterministic (mulberry32) → re-runnable, identical output.
 * - Guarded: refuses any tenant whose slug is not `demo`.
 *
 * Usage: npm run seed:demo
 */

const DEMO_SLUG = 'demo';
const SEED = 20261001;
const PAST_DAYS = 365;
const FUTURE_DAYS = 14;
const BATCH = 500;

function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FIRST = ['Marie', 'Jean', 'Sophie', 'Pierre', 'Camille', 'Lucas', 'Emma', 'Hugo', 'Léa', 'Louis', 'Chloé', 'Nathan', 'Sarah', 'Maxime', 'Inès', 'Théo', 'Jade', 'Antoine', 'Manon', 'Romain', 'Juliette', 'Adrien', 'Élise', 'Bastien', 'Clara', 'Florian', 'Anaïs', 'Quentin', 'Pauline', 'Grégoire', 'Hélène', 'Victor', 'Margaux', 'Étienne', 'Aurélie', 'Damien', 'Céline', 'Olivier', 'Nathalie', 'Fabien'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Laurent', 'Moreau', 'Simon', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Blanchard', 'Guerin', 'Muller', 'Henry', 'Perrin', 'Chevalier', 'Robin', 'Fabre', 'Aubert', 'Renard', 'Collet', 'Faure', 'Lemoine', 'Deschamps', 'Maillet', 'Pichon', 'Boulanger', 'Carpentier', 'Duret', 'Navarro'];

const ALLERGY_NOTES = ['arachides', 'gluten', 'lactose', 'fruits à coque', 'crustacés', 'œufs', 'soja'];
const VIP_NOTES = ['Habitué du vendredi', 'Préfère la terrasse', 'Anniversaire de mariage', 'Client presse', 'Offrir l’apéritif'];
const LUNCH_SLOTS = ['12:00', '12:30', '13:00', '13:30'];
const DINNER_SLOTS = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

type Shape = 'OCTAGONAL' | 'CAPSULE' | 'ROUND' | 'SQUARE' | 'BAR' | 'RECTANGULAR';
const shapeToType = (shape: string): Shape =>
    (['OCTAGONAL', 'CAPSULE', 'ROUND', 'SQUARE', 'BAR'] as string[]).includes(shape)
        ? (shape as Shape)
        : 'RECTANGULAR';

interface SeedTable { id: number; name: string; capacity: number }

/**
 * Fills the demo tenant with a credible year of bookings. When `tenantId`
 * is given (HTTP path) it must belong to the `demo` slug — never touches
 * real tenants. Returns counts for the API response.
 */
export async function seedDemoTenant(demoTenantId?: string) {
    let demo = demoTenantId
        ? await prisma.tenant.findUnique({ where: { id: demoTenantId } })
        : await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
    if (!demo && !demoTenantId) {
        // Explicit slug: createTenant would slugify "Demo Restaurant" → demo-restaurant.
        demo = await prisma.tenant.create({
            data: {
                name: 'Demo Restaurant',
                slug: DEMO_SLUG,
                trialEndsAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
                settings: { create: { avgTicket: 38, avgTicketLunch: 24, avgTicketDinner: 48 } },
            },
        });
        console.log('Created demo tenant.');
    }
    if (!demo || demo.slug !== DEMO_SLUG) throw new Error(`Refusing to seed non-demo tenant (${demo?.slug ?? 'missing'})`);
    const tenantId = demo.id;
    await prisma.tenant.updateMany({ where: { id: tenantId, onboardingComplete: false }, data: { onboardingComplete: true } });

    await prisma.restaurantSettings.upsert({
        where: { tenantId },
        update: { avgTicket: 38, avgTicketLunch: 24, avgTicketDinner: 48 },
        create: { tenantId, avgTicket: 38, avgTicketLunch: 24, avgTicketDinner: 48 },
    });

    let tables: SeedTable[] = await prisma.table.findMany({ where: { tenantId }, select: { id: true, name: true, capacity: true } });
    if (tables.length === 0) {
        await prisma.table.createMany({
            data: FLOOR_PLAN_DATA.map(t => ({
                name: t.id,
                capacity: getCapacity(t),
                type: shapeToType(t.shape),
                x: t.x, y: t.y, width: t.width, height: t.height, rotation: t.rotation ?? 0,
                tenantId,
            })),
        });
        tables = await prisma.table.findMany({ where: { tenantId }, select: { id: true, name: true, capacity: true } });
        console.log(`Created ${tables.length} demo tables.`);
    }
    tables.sort((a, b) => a.capacity - b.capacity || (a.name < b.name ? -1 : 1));

    // Wipe previous demo bookings (join rows cascade on delete).
    const wiped = await prisma.booking.deleteMany({ where: { tenantId } });
    console.log(`Wiped ${wiped.count} previous demo bookings.`);

    const rng = mulberry32(SEED);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

    // Guest pool: 150 stable identities (regulars visit 3-8× more).
    const guests = FIRST.flatMap(f => LAST.filter((_, i) => (f.length + LAST[i].length) % 3 === 0).map(l => `${f} ${l}`)).slice(0, 150);
    const regularIdx = new Set<number>();
    while (regularIdx.size < 25) regularIdx.add(Math.floor(rng() * guests.length));
    const guestContact = guests.map((_, i) => ({
        phone: `+336${String(10000000 + Math.floor(rng() * 89999999))}`,
        email: rng() < 0.6 ? `${guests[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '.')}@example.fr` : null,
        regular: regularIdx.has(i),
    }));

    const monthMult = [0.9, 0.85, 1.0, 1.05, 1.1, 1.05, 0.8, 0.55, 1.0, 1.05, 1.1, 1.35];
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const toISODate = (d: Date) => d.toISOString().slice(0, 10);
    const parisDow = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', }).format(d) === 'Sun' ? 0 : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(d)) + 1);

    interface Draft {
        id: string; name: string; phone: string | null; email: string | null; language: string;
        size: number; startTime: Date; endTime: Date; createdAt: Date; status: string;
        cancelledBy: string | null; source: string; tags: string[];
        allergyNote: string | null; birthdayDate: Date | null; vipNote: string | null;
        seatedAt: Date | null; leftAt: Date | null; guestConfirmed: boolean; tenantId: string;
        tableIds: number[];
    }
    const drafts: Draft[] = [];
    const joins: { bookingId: string; tableId: number }[] = [];

    // Per-day overlapping window tracker for capped assignment.
    interface Placed { start: number; end: number; tableIds: number[] }

    for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
        const day = new Date(todayUTC.getTime() + offset * 86400000);
        const dateStr = toISODate(day);
        const dow = parisDow(day);
        const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', month: 'numeric' }).format(day)) - 1;
        const season = monthMult[month];
        const future = offset > 0;

        const placed: Placed[] = [];
        const maxTables = Math.max(1, Math.min(tables.length - 3, Math.ceil(tables.length * (future ? 0.5 : 0.7))));

        const slots: { time: string; base: number; lunch: boolean }[] = [];
        if (dow === 1) {
            // Monday: nearly closed.
            slots.push({ time: '12:30', base: 1.5, lunch: true }, { time: '19:30', base: 1.5, lunch: false });
        } else {
            const lunchBase = dow === 0 || dow === 6 ? 8 : 6;
            const dinnerBase = dow === 5 || dow === 6 ? 10 : dow === 4 ? 7 : dow === 0 ? 4 : 5;
            for (const t of LUNCH_SLOTS) slots.push({ time: t, base: lunchBase / LUNCH_SLOTS.length, lunch: true });
            for (const t of DINNER_SLOTS) slots.push({ time: t, base: dinnerBase / DINNER_SLOTS.length, lunch: false });
        }

        for (const slot of slots) {
            const [hh, mm] = slot.time.split(':').map(Number);
            // Paris wall time → UTC instant (DST-aware via Intl).
            const parisOffsetMin = (() => {
                const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
                const parts = Object.fromEntries(dtf.formatToParts(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm))).map(p => [p.type, p.value]));
                const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute));
                return (asUTC - Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm)) / 60000;
            })();
            const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm) - parisOffsetMin * 60000);
            const end = new Date(start.getTime() + 120 * 60000);

            let count = Math.round(slot.base * season * (future ? 0.55 : 1) * (0.7 + rng() * 0.6));
            for (let i = 0; i < count; i++) {
                const sizeRoll = rng();
                const size = sizeRoll < 0.6 ? 2 : sizeRoll < 0.75 ? 3 : sizeRoll < 0.85 ? 4 : sizeRoll < 0.93 ? 5 + Math.floor(rng() * 2) : 7 + Math.floor(rng() * 2);
                const gi = regularIdx.size > 0 && rng() < 0.35
                    ? [...regularIdx][Math.floor(rng() * regularIdx.size)]
                    : Math.floor(rng() * guests.length);
                const contact = guestContact[gi];
                const name = guests[gi];
                const isPast = start.getTime() < Date.now() - 30 * 60000;

                let status = 'CONFIRMED';
                let cancelledBy: string | null = null;
                if (isPast) {
                    const r = rng();
                    if (r < 0.04) { status = 'CANCELLED'; cancelledBy = 'AUTO'; }
                    else if (r < 0.07) { status = 'CANCELLED'; cancelledBy = 'HOST'; }
                    else status = 'COMPLETED';
                } else {
                    status = rng() < 0.8 ? 'CONFIRMED' : 'PENDING';
                }

                const walkin = rng() < 0.2;
                const leadDays = walkin ? 0 : rng() < 0.3 ? Math.floor(rng() * 6) + 1 : rng() < 0.7 ? 7 + Math.floor(rng() * 14) : 21 + Math.floor(rng() * 40);
                const createdAt = walkin
                    ? new Date(start.getTime() - (10 + Math.floor(rng() * 80)) * 60000)
                    : new Date(start.getTime() - leadDays * 86400000 - Math.floor(rng() * 86400000));

                const tags: string[] = [];
                let allergyNote: string | null = null;
                let birthdayDate: Date | null = null;
                let vipNote: string | null = null;
                const tr = rng();
                if (tr < 0.04) { tags.push('VIP'); vipNote = pick(VIP_NOTES); }
                else if (tr < 0.10) { tags.push('ALLERGY'); allergyNote = pick(ALLERGY_NOTES); }
                else if (tr < 0.13) {
                    tags.push('BIRTHDAY');
                    birthdayDate = new Date(Date.UTC(day.getUTCFullYear() - (8 + Math.floor(rng() * 62)), Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)));
                }
                if (rng() < 0.03) tags.push('STROLLER');

                let seatedAt: Date | null = null;
                let leftAt: Date | null = null;
                if (status === 'COMPLETED') {
                    seatedAt = new Date(start.getTime() + (5 + Math.floor(rng() * 15)) * 60000);
                    const dur = slot.lunch ? 70 + Math.floor(rng() * 35) : 105 + Math.floor(rng() * 50);
                    leftAt = new Date(seatedAt.getTime() + dur * 60000);
                }

                // Capped table assignment (keeps widget-testable tables free).
                const tableIds: number[] = [];
                if (status !== 'CANCELLED') {
                    const overlapping = placed.filter(p => p.start < end.getTime() && p.end > start.getTime());
                    const used = new Set<number>(overlapping.flatMap(p => p.tableIds));
                    if (used.size < maxTables) {
                        const free = tables.filter(t => !used.has(t.id));
                        const single = free.find(t => t.capacity >= size);
                        if (single && used.size + 1 <= maxTables) {
                            tableIds.push(single.id);
                        } else {
                            const pair = free.filter(t => t.capacity >= Math.ceil(size / 2)).slice(0, 2);
                            if (pair.length === 2 && pair[0].capacity + pair[1].capacity >= size && used.size + 2 <= maxTables) {
                                tableIds.push(pair[0].id, pair[1].id);
                            }
                        }
                    }
                    if (tableIds.length > 0) placed.push({ start: start.getTime(), end: end.getTime(), tableIds });
                }

                const id = randomUUID();
                drafts.push({
                    id, name, phone: contact.phone, email: contact.email,
                    language: rng() < 0.9 ? 'fr' : 'en',
                    size, startTime: start, endTime: end, createdAt, status, cancelledBy,
                    source: walkin ? 'WALKIN' : 'RESERVATION', tags,
                    allergyNote, birthdayDate, vipNote, seatedAt, leftAt,
                    guestConfirmed: status === 'COMPLETED' ? rng() < 0.7 : rng() < 0.3,
                    tenantId, tableIds,
                });
                for (const tid of tableIds) joins.push({ bookingId: id, tableId: tid });
            }
        }
        if (offset % 60 === 0) console.log(`Generated ${dateStr} (${drafts.length} bookings so far)…`);
    }

    console.log(`Inserting ${drafts.length} bookings + ${joins.length} table links…`);
    for (let i = 0; i < drafts.length; i += BATCH) {
        const chunk = drafts.slice(i, i + BATCH).map(({ tableIds: _t, ...d }) => d);
        await prisma.booking.createMany({ data: chunk as any });
        if ((i / BATCH) % 4 === 0) console.log(`  …${Math.min(i + BATCH, drafts.length)}/${drafts.length}`);
    }
    for (let i = 0; i < joins.length; i += 1000) {
        const chunk = joins.slice(i, i + 1000);
        await prisma.$executeRawUnsafe(
            `INSERT INTO "_BookingTables" ("A", "B") VALUES ${chunk.map((_, k) => `($${k * 2 + 1}, $${k * 2 + 2})`).join(',')} ON CONFLICT DO NOTHING`,
            ...chunk.flatMap(j => [j.bookingId, j.tableId]),
        );
    }
    console.log(`Done: ${drafts.length} bookings, ${joins.length} links on tenant demo.`);
    return { bookings: drafts.length, tableLinks: joins.length, tables: tables.length };
}

if (require.main === module) {
    seedDemoTenant()
        .catch(e => {
            console.error('Demo seed failed:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
