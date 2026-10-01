import { Router, Response } from 'express';
import { isAuthenticated, requireTenant, requireRole, AuthRequest } from '../middleware/isAuthenticated';
import { availabilityLimiter } from '../middleware/rateLimit';
import { prisma } from '../lib/prisma';
import { isTrialActive, parseSlug } from '../services/tenantService';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tenants
 *   description: Tenant restaurant context
 */

/**
 * @swagger
 * /tenants/me:
 *   get:
 *     summary: Current tenant with trial status
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant context
 */
router.get('/tenants/me', isAuthenticated, requireTenant, async (req: AuthRequest, res: Response) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenant!.id } });
    if (!tenant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        trialEndsAt: tenant.trialEndsAt,
        trialActive: isTrialActive(tenant.trialEndsAt),
        onboardingComplete: tenant.onboardingComplete,
    });
});

/**
 * @swagger
 * /tenants/me:
 *   patch:
 *     summary: Update current tenant (name, onboarding progress)
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated tenant
 */
router.patch('/tenants/me', isAuthenticated, requireTenant, async (req: AuthRequest, res: Response) => {
    const { name, slug, onboardingComplete } = (req.body ?? {}) as {
        name?: unknown;
        slug?: unknown;
        onboardingComplete?: unknown;
    };
    const data: { name?: string; slug?: string; onboardingComplete?: boolean } = {};

    if (name !== undefined) {
        const trimmed = String(name).trim().substring(0, 60);
        if (trimmed.length < 2) return res.status(400).json({ error: 'Restaurant name must be at least 2 characters.' });
        data.name = trimmed;
    }
    if (slug !== undefined) {
        let parsed: string;
        try {
            parsed = parseSlug(slug);
        } catch (e) {
            return res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid address.' });
        }
        const taken = await prisma.tenant.findUnique({ where: { slug: parsed } });
        if (taken && taken.id !== req.tenant!.id) {
            return res.status(409).json({ error: 'This address is already taken. Try another one.' });
        }
        data.slug = parsed;
    }
    if (onboardingComplete !== undefined) {
        if (typeof onboardingComplete !== 'boolean') {
            return res.status(400).json({ error: 'onboardingComplete must be a boolean.' });
        }
        data.onboardingComplete = onboardingComplete;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    const tenant = await prisma.tenant.update({ where: { id: req.tenant!.id }, data });
    res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        trialEndsAt: tenant.trialEndsAt,
        trialActive: isTrialActive(tenant.trialEndsAt),
        onboardingComplete: tenant.onboardingComplete,
    });
});

/**
 * @swagger
 * /tenants/me/export:
 *   get:
 *     summary: GDPR Art.20 — full tenant data export (JSON)
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant, settings, tables and bookings
 */
router.get('/tenants/me/export', isAuthenticated, requireTenant, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const tid = req.tenant!.id;
        const [tenant, settings, tables, bookings] = await Promise.all([
            prisma.tenant.findUnique({ where: { id: tid } }),
            prisma.restaurantSettings.findUnique({ where: { tenantId: tid } }),
            prisma.table.findMany({ where: { tenantId: tid } }),
            prisma.booking.findMany({ where: { tenantId: tid }, include: { tables: true } as any }),
        ]);
        res.json({ exportedAt: new Date().toISOString(), tenant, settings, tables, bookings });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /tenants/slug-available:
 *   get:
 *     summary: Check whether a public booking address is free
 *     tags: [Tenants]
 *     responses:
 *       200:
 *         description: Availability of the slug
 */
router.get('/tenants/slug-available', availabilityLimiter, async (req: AuthRequest, res: Response) => {
    try {
        const slug = parseSlug(req.query.slug);
        const existing = await prisma.tenant.findUnique({ where: { slug } });
        res.json({ slug, available: !existing });
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid address.' });
    }
});

export default router;
