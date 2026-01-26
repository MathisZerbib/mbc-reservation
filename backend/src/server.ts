import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient, TableType } from '@prisma/client';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Helper: Calculate duration in minutes
const getDuration = (guestSize: number) => (guestSize >= 6 ? 180 : 120);

// Helper: Add minutes to date
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API: Check Availability
app.get('/api/availability', async (req, res) => {
    try {
        const { date, time, size } = req.query;

        if (!date || !time || !size) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const guestSize = parseInt(size as string);
        const requestedStart = new Date(`${date}T${time}`);
        // Check if invalid date
        if (isNaN(requestedStart.getTime())) {
            return res.status(400).json({ error: 'Invalid date/time format' });
        }

        const duration = getDuration(guestSize);
        const requestedEnd = addMinutes(requestedStart, duration);

        // Buffer time (15 mins)
        const buffer = 15;

        // Find tables with enough capacity
        const candidateTables = await prisma.table.findMany({
            where: { capacity: { gte: guestSize } },
        });

        const availableTables = [];

        for (const table of candidateTables) {
            // Check for overlapping bookings
            // Overlap logic:
            // (StartA < EndB) and (EndA > StartB)
            // New Booking: S_new, E_new. Buffered range: [S_new - 15, E_new + 15]
            // Existing Booking: S_old, E_old. Buffered range: [S_old - 15, E_old + 15] -- Actually buffer is usually applied to the END of a booking for cleaning.
            // "Automatically add 15 minutes between bookings for table cleaning."
            // This means a booking effectively occupies [Start, End + 15].
            // So NewBooking needs [Start, End + 15] to be free.
            // So Collision if:
            // Existing.Start < New.End + 15 AND Existing.End + 15 > New.Start

            const collisions = await prisma.booking.findMany({
                where: {
                    tableId: table.id,
                    status: { not: 'CANCELLED' },
                    AND: [
                        { startTime: { lt: addMinutes(requestedEnd, buffer) } },
                        { endTime: { gt: addMinutes(requestedStart, -buffer) } }
                    ]
                }
            });

            if (collisions.length === 0) {
                availableTables.push(table);
            }
        }

        res.json({ available: availableTables.length > 0, tables: availableTables });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Create Booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { name, phone, email, size, date, time } = req.body;

        // Basic validation
        if (!name || !phone || !size || !date || !time) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        const guestSize = parseInt(size);
        const requestedStart = new Date(`${date}T${time}`);
        if (isNaN(requestedStart.getTime())) {
            return res.status(400).json({ error: 'Invalid date/time format' });
        }

        const duration = getDuration(guestSize);
        const requestedEnd = addMinutes(requestedStart, duration);
        const buffer = 15;

        const candidateTables = await prisma.table.findMany({
            where: { capacity: { gte: guestSize } },
            orderBy: { capacity: 'asc' }
        });

        let assignedTable = null;

        for (const table of candidateTables) {
            const collisions = await prisma.booking.findMany({
                where: {
                    tableId: table.id,
                    status: { not: 'CANCELLED' },
                    AND: [
                        { startTime: { lt: addMinutes(requestedEnd, buffer) } },
                        { endTime: { gt: addMinutes(requestedStart, -buffer) } }
                    ]
                }
            });

            if (collisions.length === 0) {
                assignedTable = table;
                break;
            }
        }

        if (!assignedTable) {
            return res.status(409).json({ error: 'No table available' });
        }

        // Create Booking
        const newBooking = await prisma.booking.create({
            data: {
                guestName: name,
                guestPhone: phone,
                guestEmail: email || '',
                size: guestSize,
                startTime: requestedStart,
                endTime: requestedEnd,
                tableId: assignedTable.id,
            }
        });

        // Validated - Notify Admin via Socket
        io.emit('booking-update', { type: 'new', booking: newBooking });

        res.json(newBooking);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/bookings', async (req, res) => {
    // For Admin to get all bookings
    const bookings = await prisma.booking.findMany({
        include: { table: true }
    });
    res.json(bookings);
});

const PORT = process.env.PORT || 3000;

async function main() {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
