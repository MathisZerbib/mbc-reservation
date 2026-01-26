import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { ADJACENCY_MAP } from './utils/adjacency';

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

// Helper: Find available tables for a slot
async function getAvailableTables(requestedStart: Date, requestedEnd: Date) {
    const buffer = 15;
    const allTables = await prisma.table.findMany();
    const availableTables = [];

    for (const table of allTables) {
        const collisions = await prisma.booking.findMany({
            where: {
                tables: { some: { id: table.id } },
                status: { not: 'CANCELLED' },
                AND: [
                    { startTime: { lt: addMinutes(requestedEnd, buffer) } },
                    { endTime: { gt: addMinutes(requestedStart, -buffer) } }
                ]
            } as any
        });
        if (collisions.length === 0) {
            availableTables.push(table);
        }
    }
    return availableTables;
}

// Algorithm: Find set of adjacent tables for group size
function findTableCombination(size: number, availableTables: any[]) {
    // 1. Try single table first (best fit)
    const single = availableTables
        .filter(t => t.capacity >= size)
        .sort((a, b) => a.capacity - b.capacity)[0];

    if (single) return [single];

    // 2. Greedy search for adjacent tables
    const tableMap = new Map(availableTables.map(t => [t.name, t]));

    for (const seed of availableTables) {
        let result: any[] = [seed];
        let currentCapacity = seed.capacity;

        const queue = [...(ADJACENCY_MAP[seed.name] || [])];
        const visited = new Set([seed.name]);

        while (queue.length > 0 && currentCapacity < size) {
            const nextName = queue.shift();
            if (!nextName || visited.has(nextName)) continue;
            visited.add(nextName);

            const neighbor = tableMap.get(nextName);
            if (neighbor) {
                result.push(neighbor);
                currentCapacity += neighbor.capacity;
                queue.push(...(ADJACENCY_MAP[nextName] || []));
            }
        }

        if (currentCapacity >= size) {
            return result;
        }
    }

    return null;
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/availability', async (req, res) => {
    try {
        const { date, time, size } = req.query;
        if (!date || !time || !size) return res.status(400).json({ error: 'Missing parameters' });

        const guestSize = parseInt(size as string);
        const requestedStart = new Date(`${date}T${time}`);
        if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

        const duration = getDuration(guestSize);
        const requestedEnd = addMinutes(requestedStart, duration);

        const available = await getAvailableTables(requestedStart, requestedEnd);
        const combination = findTableCombination(guestSize, available);

        res.json({
            available: !!combination,
            tables: combination || []
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        const { name, phone, email, size, date, time } = req.body;
        if (!name || !phone || !size || !date || !time) return res.status(400).json({ error: 'Missing fields' });

        const guestSize = parseInt(size);
        const requestedStart = new Date(`${date}T${time}`);
        if (isNaN(requestedStart.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

        const duration = getDuration(guestSize);
        const requestedEnd = addMinutes(requestedStart, duration);

        const newBooking = await prisma.booking.create({
            data: {
                guestName: name,
                guestPhone: phone,
                guestEmail: email || '',
                size: guestSize,
                startTime: requestedStart,
                endTime: requestedEnd,
                tables: {
                    connect: [] // Manager will assign tables manually
                }
            } as any,
            include: { tables: true } as any
        });

        io.emit('booking-update', { type: 'new', booking: newBooking });
        res.json(newBooking);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/bookings', async (req, res) => {
    const bookings = await prisma.booking.findMany({
        include: { tables: true } as any
    });
    res.json(bookings);
});

// Update table assignments manually
app.patch('/api/bookings/:id/tables', async (req, res) => {
    try {
        const { id } = req.params;
        const { tableNames } = req.body; // Array of table names like ["22", "25"]

        const tables = await prisma.table.findMany({
            where: { name: { in: tableNames } }
        });

        const updatedBooking = await prisma.booking.update({
            where: { id },
            data: {
                tables: {
                    set: [], // Clear existing
                    connect: tables.map(t => ({ id: t.id }))
                }
            } as any,
            include: { tables: true } as any
        });

        io.emit('booking-update', { type: 'update', booking: updatedBooking });
        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update assignment' });
    }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
