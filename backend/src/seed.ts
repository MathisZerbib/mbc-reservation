import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { FLOOR_PLAN_DATA, getCapacity } from './utils/floorPlanData';
import { ADJACENCY_MAP } from './utils/adjacency';

enum TableType {
    OCTAGONAL = 'OCTAGONAL',
    RECTANGULAR = 'RECTANGULAR',
    CAPSULE = 'CAPSULE',
    ROUND = 'ROUND',
    SQUARE = 'SQUARE',
    BAR = 'BAR',
}

const shapeToType = (shape: string): TableType => {
    switch (shape) {
        case 'OCTAGONAL': return TableType.OCTAGONAL;
        case 'CAPSULE': return TableType.CAPSULE;
        case 'ROUND': return TableType.ROUND;
        case 'SQUARE': return TableType.SQUARE;
        case 'BAR': return TableType.BAR;
        case 'RECTANGULAR':
        default: return TableType.RECTANGULAR;
    }
};

async function seed() {
    console.log('Starting seed check...');

    try {
        // 0. Ensure the default (pre-tenancy) tenant exists.
        let defaultTenant = await prisma.tenant.findUnique({ where: { slug: 'mbc' } });
        if (!defaultTenant) {
            defaultTenant = await prisma.tenant.create({
                data: {
                    name: 'MBC',
                    slug: 'mbc',
                    trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    settings: { create: {} },
                },
            });
            console.log('Created default tenant (mbc).');
        }
        const tenantId = defaultTenant.id;

        // 1. Seed admin user if not exists (credentials from env only — never hardcoded)
        const adminEmail = process.env.SEED_ADMIN_EMAIL;
        const adminPassword = process.env.SEED_ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping admin creation.');
        } else {
            const existingAdmin = await prisma.user.findUnique({
                where: { email: adminEmail }
            });

            if (!existingAdmin) {
                const hashed = await bcrypt.hash(adminPassword, 12);
                await prisma.user.create({
                    data: { email: adminEmail, password: hashed, tenantId, role: 'OWNER', emailVerified: new Date() },
                });
                console.log(`Created admin user: ${adminEmail}`);
            } else {
                console.log('Admin user already exists, skipping user creation.');
            }
        }

        // 2. Seed tables if none exist
        const tableCount = await prisma.table.count({ where: { tenantId } });

        if (tableCount === 0) {
            console.log('No tables found, seeding tables from floor plan...');

            const tablesToCreate = FLOOR_PLAN_DATA.map(t => ({
                name: t.id,
                capacity: getCapacity(t),
                type: shapeToType(t.shape),
                x: t.x,
                y: t.y,
                width: t.width,
                height: t.height,
                rotation: t.rotation ?? 0,
                tenantId,
            }));

            await prisma.table.createMany({
                data: tablesToCreate
            });

            console.log(`Seeded ${tablesToCreate.length} tables using createMany.`);
        } else {
            console.log(`Found ${tableCount} tables, skipping table seeding.`);
        }

        // 3. Backfill geometry for tables created before width/height/rotation existed.
        //    Safe: no constant table is exactly 60x60 rot 0, so "still at column
        //    defaults" uniquely identifies pre-geometry rows. Never touches editor changes.
        for (const t of FLOOR_PLAN_DATA) {
            await prisma.table.updateMany({
                where: { tenantId, name: t.id, width: 60, height: 60, rotation: 0 },
                data: {
                    x: t.x,
                    y: t.y,
                    width: t.width,
                    height: t.height,
                    rotation: t.rotation ?? 0,
                    type: shapeToType(t.shape),
                },
            });
        }
        console.log('Backfilled table geometry from floor plan constants.');

        // 4. Ensure settings row exists for the default tenant.
        await prisma.restaurantSettings.upsert({
            where: { tenantId },
            update: {},
            create: { tenantId },
        });
        console.log('Ensured restaurant settings row.');

        // 5. Backfill adjacency edges from the canonical map (idempotent).
        //    Only seeds when no manual edges exist yet — never overwrites editor changes.
        const linkCount = await prisma.tableLink.count({ where: { a: { tenantId } } });
        if (linkCount === 0) {
            const dbTables = await prisma.table.findMany({ where: { tenantId }, select: { id: true, name: true } });
            const idByName = new Map(dbTables.map(t => [t.name, t.id]));
            const seen = new Set<string>();
            const edges: { aId: number; bId: number }[] = [];

            for (const [name, neighbors] of Object.entries(ADJACENCY_MAP)) {
                const aId = idByName.get(name);
                if (aId === undefined) continue;
                for (const neighbor of neighbors) {
                    const bId = idByName.get(neighbor);
                    if (bId === undefined || aId === bId) continue;
                    const key = aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    edges.push(aId < bId ? { aId, bId } : { aId: bId, bId: aId });
                }
            }

            if (edges.length > 0) {
                await prisma.tableLink.createMany({ data: edges, skipDuplicates: true });
            }
            console.log(`Seeded ${edges.length} adjacency edges.`);
        } else {
            console.log(`Found ${linkCount} adjacency edges, skipping adjacency seeding.`);
        }

        console.log('Seed check completed.');
    } catch (e: any) {
        if (e.code === 'P2021') {
            console.error('Error: Database tables do not exist. Please run migrations first (e.g., npx prisma db push).');
        } else {
            throw e;
        }
    }
}

seed()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export { seed };