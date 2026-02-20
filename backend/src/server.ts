import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { bookingRoutes } from './routes/bookingRoutes';
import tableRoutes from './routes/tableRoutes';
import authRoutes from './routes/authRoutes';
import protectedRoutes from './routes/protectedRoutes';
import testRoutes from './routes/testRoutes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
// Fallback to localhost if the Render variable isn't set (for local dev)
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;


const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    process.env.NODE_ENV === 'development' &&
    "http://localhost:3000"
].filter((origin): origin is string => Boolean(origin));


const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    },
});

// app.set('trust proxy', true); ?????? gemini generated

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
app.use(express.static('public'));

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log(`📄 Swagger docs available at ${baseUrl}/api-docs`);

// Routes
app.use('/api', bookingRoutes(io));
app.use('/api', tableRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);
// app.use('/api/analytics', protectedRoutes); // Analytics route
app.use('/api/tests', testRoutes); // Test route
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});



server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
