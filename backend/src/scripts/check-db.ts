
import { prisma } from '../lib/prisma';
import dayjs from 'dayjs';

async function checkBookings() {
    const count = await prisma.booking.count();
    console.log(`Total bookings: ${count}`);

    const bookings = await prisma.booking.findMany({
        orderBy: { startTime: 'desc' },
        include: { tables: true }
    });

    console.log('\nBookings Analysis:');
    bookings.forEach(b => {
        const raw = b.startTime.toISOString();
        const formatted = dayjs(b.startTime).format('YYYY-MM-DD');
        const time = dayjs(b.startTime).format('HH:mm');
        console.log(`- ${b.name}:`);
        console.log(`  Raw: ${raw}`);
        console.log(`  Day: ${formatted}`);
        console.log(`  Time: ${time}`);
        console.log(`  Tables: ${b.tables.map(t => t.name).join(', ')}`);
    });
}

checkBookings()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
