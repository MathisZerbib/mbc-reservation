import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { bookingRoutes } from './routes/bookingRoutes';
import tableRoutes from './routes/tableRoutes';
import { seed } from './seed'; // adjust import as needed

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173"
].filter((origin): origin is string => Boolean(origin));


const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  },
});



app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Routes
app.use('/api', bookingRoutes(io));
app.use('/api', tableRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/seed', async (req, res) => {
  if (process.env.SEED_SECRET && req.headers['x-seed-secret'] !== process.env.SEED_SECRET) {
    return res.status(403).send('Forbidden');
  }
  try {
    await seed();
    res.send('Seeded!');
  } catch (e) {
    res.status(500).send('Seed failed');
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
