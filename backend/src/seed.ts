import bcrypt from 'bcryptjs';

enum TableType {
    OCTAGONAL = 'OCTAGONAL',
    RECTANGULAR = 'RECTANGULAR',
    CAPSULE = 'CAPSULE',
    ROUND = 'ROUND',
    BAR = 'BAR',
}
import { prisma } from './lib/prisma';

async function seed() {
    console.log('Starting seed...');
    // Clear existing tables
    try {
        await prisma.booking.deleteMany();
        await prisma.table.deleteMany();
    } catch (e) {
        console.log('Error clearing tables, maybe first run?');
    }

    const tables: { name: string; capacity: number; type: TableType }[] = [];

    // Use FLOOR_PLAN_DATA from utils to ensure consistency
    import('./utils/floorPlanData').then(({ FLOOR_PLAN_DATA, getCapacity }) => {
        FLOOR_PLAN_DATA.forEach(t => {
            let type: TableType;
            switch (t.shape) {
                case 'OCTAGONAL': type = TableType.OCTAGONAL; break;
                case 'CAPSULE': type = TableType.CAPSULE; break;
                case 'ROUND': type = TableType.ROUND; break;
                // case 'BAR': type = TableType.BAR; break;
                case 'SQUARE':
                case 'RECTANGULAR':
                default: type = TableType.RECTANGULAR; break;
            }

            tables.push({
                name: t.id,
                capacity: getCapacity(t),
                type
            });
        });

        // Also add the BAR tables if they are not in the FLOOR_PLAN_DATA yet (currently commented out there)
        const existingTableIds = new Set(tables.map(t => t.name));
        // [40, 42, 44, 46, 48].forEach(id => {
        //     if (!existingTableIds.has(String(id))) {
        //         tables.push({ name: String(id), capacity: 1, type: TableType.BAR });
        //     }
        // });
    });

    // 1. Seed users (requested first)
    const email = 'admin@example.com';
    const password = 'admin';
    await prisma.user.deleteMany({ where: { email } });
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
        data: { email, password: hashed },
    });
    console.log(`Created user ${email} with password ${password}`);

    // 2. Seed tables
    console.log(`Seeding ${tables.length} tables...`);

    for (const t of tables) {
        await prisma.table.upsert({
            where: { name: t.name },
            update: t,
            create: t,
        });
    }

    console.log('Seeding completed.');
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

export { seed };