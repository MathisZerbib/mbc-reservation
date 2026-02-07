
import { prisma } from '../lib/prisma';
import { addMinutes, getDuration } from '../services/bookingService';
import dayjs from 'dayjs';

async function fullBook() {
    const dateArg = process.argv[2];
    if (!dateArg) {
        console.error('Please provide a date in YYYY-MM-DD format');
        process.exit(1);
    }

    const time = '21:00';
    console.log(`🚀 Starting full booking for ${dateArg} at ${time}...`);

    const tables = await prisma.table.findMany();
    console.log(`Found ${tables.length} tables to book.`);

    const start = new Date(`${dateArg}T${time}`);
    if (isNaN(start.getTime())) {
        console.error('Invalid date format. Use YYYY-MM-DD');
        process.exit(1);
    }

    for (const table of tables) {
        const duration = getDuration(table.capacity);
        const end = addMinutes(start, duration);

        try {
            await prisma.booking.create({
                data: {
                    name: `Auto: ${table.name}`,
                    email: 'test@example.com',
                    phone: '0000000000',
                    size: table.capacity,
                    startTime: start,
                    endTime: end,
                    status: 'CONFIRMED',
                    language: 'en',
                    tables: {
                        connect: [{ id: table.id }]
                    }
                }
            } as any);
        } catch (e) {
            console.error(`Failed to book Table ${table.name}`);
        }
    }

    console.log('\n✅ Full booking completed!');
    console.log(`ℹ️  Note: You must navigate to ${dayjs(start).format('dddd, D MMM YYYY')} in the dashboard to see these.`);
    console.log('ℹ️  Tip: If the dashboard doesn\'t update, please refresh the page (F5).\n');
}

fullBook()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
