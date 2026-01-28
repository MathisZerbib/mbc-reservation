import { PrismaClient, TableType } from '@prisma/client';

export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
    console.log('Starting seed...');
    // Clear existing tables
    try {
        await prisma.booking.deleteMany();
        await prisma.table.deleteMany();
    } catch (e) {
        console.log('Error clearing tables, maybe first run?');
    }

    const tables: { name: string; capacity: number; type: TableType }[] = [];

    // 1. Octagonal Tables (1, 10) - Cap 7
    tables.push(
        { name: '1', capacity: 7, type: TableType.OCTAGONAL },
        { name: '10', capacity: 7, type: TableType.OCTAGONAL }
    );

    // 2. Rectangular 5-seaters (2, 4, 7)
    [2, 4, 7].forEach(id => {
        tables.push({ name: String(id), capacity: 5, type: TableType.RECTANGULAR });
    });

    // 3. Large Group Tables (11, 12, 20-22, 23-25, 26-28, 30-36) - Cap 6
    // Assuming these are all ranges inclusive
    const group6Ids = [
        11, 12,
        20, 21, 22,
        23, 24, 25,
        26, 27, 28,
        30, 31, 32, 33, 34, 35, 36
    ];

    group6Ids.forEach(id => {
        let type: TableType = TableType.CAPSULE;
        if (id === 11 || id === 12) type = TableType.RECTANGULAR;

        tables.push({ name: String(id), capacity: 6, type });
    });

    // 4. All Other Tables (Standard 2-4 or Bar 1)
    // Rectangular others
    [3, 5, 6, 8, 9].forEach(id => {
        tables.push({ name: String(id), capacity: 4, type: TableType.RECTANGULAR });
    });

    // 50-54 - Rectangular small
    [50, 51, 52, 53, 54].forEach(id => {
        tables.push({ name: String(id), capacity: 4, type: TableType.RECTANGULAR });
    });

    // 100-105 - Round/Octagonal small
    [100, 101, 102, 103, 104, 105].forEach(id => {
        tables.push({ name: String(id), capacity: 2, type: TableType.ROUND });
    });

    // BAR (40-48) - Cap 1
    [40, 41, 42, 43, 44, 45, 46, 47, 48].forEach(id => {
        tables.push({ name: `BAR-${id}`, capacity: 1, type: TableType.BAR });
    });

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

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
