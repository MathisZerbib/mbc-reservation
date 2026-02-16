// import { prisma } from '../lib/prisma';
// import { addMinutes, getDuration } from './bookingService';
// import dayjs from 'dayjs';

// export async function fullBook(date: string, number?: number): Promise<void> {
//     const time = '21:00';
//     console.log(`🚀 Starting full booking for ${date} at ${time}...`);

//     const allTables = await prisma.table.findMany();
//     const tables = number ? allTables.slice(0, number) : allTables;
//     console.log(`Found ${allTables.length} tables, booking ${tables.length} tables.`);

//     const start = new Date(`${date}T${time}`);
//     if (isNaN(start.getTime())) {
//         throw new Error('Invalid date format. Use YYYY-MM-DD');
//     }

//     for (const table of tables) {
//         const duration = getDuration(table.capacity);
//         const end = addMinutes(start, duration);

//         try {
//             await prisma.booking.create({
//                 data: {
//                     name: `Auto: ${table.name}`,
//                     email: 'test@example.com',
//                     phone: '0000000000',
//                     size: table.capacity,
//                     startTime: start,
//                     endTime: end,
//                     status: 'CONFIRMED',
//                     language: 'en',
//                     tables: {
//                         connect: [{ id: table.id }]
//                     }
//                 }
//             } as any);
//         } catch (e) {
//             console.error(`Failed to book Table ${table.name}:`, e);
//         }
//     }

//     console.log('\n✅ Full booking completed!');
//     console.log(`ℹ️  Note: You must navigate to ${dayjs(start).format('dddd, D MMM YYYY')} in the dashboard to see these.`);
//     console.log('ℹ️  Tip: If the dashboard doesn\'t update, please refresh the page (F5).\n');
// }

import { prisma } from '../lib/prisma';
import { addMinutes, getDuration } from './bookingService';
import dayjs from 'dayjs';

export async function fullBook(date: string, number?: number): Promise<void> {
    const time = '21:00';
    console.log(`🚀 Starting full booking for ${date} at ${time}...`);

    const allTables = await prisma.table.findMany();
    const tables = number ? allTables.slice(0, number) : allTables;
    console.log(`Found ${allTables.length} tables, booking ${tables.length} tables.`);

    const start = new Date(`${date}T${time}`);
    if (isNaN(start.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
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
            console.error(`Failed to book Table ${table.name}:`, e);
        }
    }

    console.log('\n✅ Full booking completed!');
    console.log(`ℹ️  Note: You must navigate to ${dayjs(start).format('dddd, D MMM YYYY')} in the dashboard to see these.`);
    console.log('ℹ️  Tip: If the dashboard doesn\'t update, please refresh the page (F5).\n');
}