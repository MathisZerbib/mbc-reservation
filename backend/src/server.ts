import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { bookingRoutes } from './routes/bookingRoutes';
import tableRoutes from './routes/tableRoutes';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    },
});

app.use(cors({
    origin: "http://localhost:5173",
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
