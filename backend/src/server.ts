import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { bookingRoutes } from './routes/bookingRoutes';
import { tableRoutes } from './routes/tableRoutes';
import { settingsRoutes } from './routes/settingsRoutes';
import tenantRoutes from './routes/tenantRoutes';
import statsRoutes from './routes/statsRoutes';
import authRoutes from './routes/authRoutes';
import protectedRoutes from './routes/protectedRoutes';
import testRoutes from './routes/testRoutes';
import userRoutes from './routes/userRoutes';
import { prisma } from './lib/prisma';
import swaggerUi from 'swagger-ui-express';
import { startCleanupTask } from './services/cleanupService';
import { swaggerSpec } from './docs/swagger';
import { tenantRoom } from './lib/tenantSocket';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
// Fallback to localhost if the Render variable isn't set (for local dev)
const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;


const exactOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    process.env.NODE_ENV === 'development' &&
    "http://localhost:3000"
].filter((origin): origin is string => Boolean(origin));

// Vercel issues a fresh URL per preview deployment, so an exact allowlist
// can never match them. Accept this project's Vercel deployments by pattern
// (production + all previews). Scoped to our project slug so we don't open
// CORS to arbitrary sites.
const vercelDeployments =
    /^https:\/\/mbc-reservation(-.*)?-mathiszerbibs-projects\.vercel\.app$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true; // same-origin, curl, mobile apps
    if (exactOrigins.includes(origin)) return true;
    if (vercelDeployments.test(origin)) return true;
    return false;
}

const corsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST"]
    },
});

// Trust the Render proxy (exactly one hop) so req.ip reflects the real
// client behind X-Forwarded-For. Required for express-rate-limit
// (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) and Turnstile remoteip.
// A count — not `true` — so clients cannot spoof their IP past the proxy.
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(express.json());
// CSP disabled: swagger-ui serves inline assets; other helmet protections on.
// crossOriginResourcePolicy is cross-origin so Vercel frontends can <img>
// backend-served /uploads/* (Cloudinary URLs are unaffected, this is for the
// local-disk dev fallback).
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.static('public', {
    setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}uploads${path.sep}`) || filePath.includes('/uploads/')) {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));

// Socket.io: verify the handshake JWT and join the tenant room.
// No token (public widget) or invalid token → connected but roomless:
// such sockets receive nothing, never hard-failing realtime.
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (token) {
            const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as { userId?: string };
            if (payload?.userId) {
                const user = await prisma.user.findUnique({
                    where: { id: payload.userId },
                    select: { tenantId: true },
                });
                if (user?.tenantId) socket.join(tenantRoom(user.tenantId));
            }
        }
    } catch {
        // Roomless connection — no realtime for this socket.
    }
    next();
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id, 'rooms:', [...socket.rooms].join(','));
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log(`📄 Swagger docs available at ${baseUrl}/api-docs`);

// Routes
app.use('/api', bookingRoutes(io));
app.use('/api', tableRoutes(io));
app.use('/api', settingsRoutes(io));
app.use('/api', tenantRoutes);
app.use('/api', statsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);
// Dev/demo helpers (bulk booking). Guarded by demo-session auth in testRoutes.
app.use('/api/tests', testRoutes); // Tests routes
app.use('/api', userRoutes);
app.get('/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'degraded', reason: 'database unreachable' });
    }
});
app.get('/version', (_req, res) => {
    res.json({
        version: '1.0.0',
        commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
        environment: process.env.NODE_ENV || 'development',
    });
});



server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    startCleanupTask(io);
});
