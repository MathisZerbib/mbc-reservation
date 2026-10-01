import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { isAuthenticated, requireTenant, requireRole, AuthRequest } from '../middleware/isAuthenticated';
import { prisma } from '../lib/prisma';

const router = Router();

const toDTO = (u: { id: string; email: string; role: string; emailVerified: Date | null; createdAt: Date }) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
});

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Team management (owner only)
 */

router.get('/users', isAuthenticated, requireTenant, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { tenantId: req.tenant!.id },
            select: { id: true, email: true, role: true, emailVerified: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json(users.map(toDTO));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/users', isAuthenticated, requireTenant, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const { email, password, role } = (req.body ?? {}) as { email?: unknown; password?: unknown; role?: unknown };
        const cleanEmail = String(email ?? '').trim().toLowerCase().substring(0, 100);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (typeof password !== 'string' || password.length < 12) {
            return res.status(400).json({ error: 'Password must be at least 12 characters' });
        }
        if (role !== 'OWNER' && role !== 'STAFF') {
            return res.status(400).json({ error: 'Role must be OWNER or STAFF' });
        }
        const taken = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (taken) return res.status(409).json({ error: 'Email already in use' });
        const user = await prisma.user.create({
            data: {
                email: cleanEmail,
                password: await bcrypt.hash(password, 12),
                tenantId: req.tenant!.id,
                role,
                emailVerified: new Date(),
            },
        });
        res.status(201).json(toDTO(user));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/users/:id', isAuthenticated, requireTenant, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id)) id = id[0];
        if (id === req.payload?.userId) {
            return res.status(400).json({ error: 'You cannot remove yourself' });
        }
        const target = await prisma.user.findFirst({ where: { id, tenantId: req.tenant!.id } });
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'OWNER') {
            const owners = await prisma.user.count({ where: { tenantId: req.tenant!.id, role: 'OWNER' } });
            if (owners <= 1) return res.status(400).json({ error: 'Cannot remove the last owner' });
        }
        await prisma.user.delete({ where: { id } });
        res.json({ removed: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
