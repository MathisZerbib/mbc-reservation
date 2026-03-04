import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { FLOOR_PLAN_DATA, getCapacity } from './utils/floorPlanData';

enum TableType {
    OCTAGONAL = 'OCTAGONAL',
    RECTANGULAR = 'RECTANGULAR',
    CAPSULE = 'CAPSULE',
    ROUND = 'ROUND',
    BAR = 'BAR',
}

async function seed() {
    console.log('Starting seed check...');

    try {
        // 1. Seed admin user if not exists
        const adminEmail = 'admin@example.com';
        const existingAdmin = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (!existingAdmin) {
            const password = 'admin';
            const hashed = await bcrypt.hash(password, 12);
            await prisma.user.create({
                data: { email: adminEmail, password: hashed },
            });
            console.log(`Created admin user: ${adminEmail}`);
        } else {
            console.log('Admin user already exists, skipping user creation.');
        }

        // 2. Seed tables if none exist
        const tableCount = await prisma.table.count();

        if (tableCount === 0) {
            console.log('No tables found, seeding tables from floor plan...');

            const tablesToCreate = FLOOR_PLAN_DATA.map(t => {
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

                return {
                    name: t.id,
                    capacity: getCapacity(t),
                    type,
                    x: t.x,
                    y: t.y
                };
            });

            await prisma.table.createMany({
                data: tablesToCreate
            });

            console.log(`Seeded ${tablesToCreate.length} tables using createMany.`);
        } else {
            console.log(`Found ${tableCount} tables, skipping table seeding.`);
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