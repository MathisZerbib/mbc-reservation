import { Router, Response } from 'express';
import { isAuthenticated, requireTenant, AuthRequest } from '../middleware/isAuthenticated';
import { prisma } from '../lib/prisma';
import { isTrialActive } from '../services/tenantService';

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
    const { name, onboardingComplete } = (req.body ?? {}) as { name?: unknown; onboardingComplete?: unknown };
    const data: { name?: string; onboardingComplete?: boolean } = {};

    if (name !== undefined) {
        const trimmed = String(name).trim().substring(0, 60);
        if (trimmed.length < 2) return res.status(400).json({ error: 'Restaurant name must be at least 2 characters.' });
        data.name = trimmed;
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

export default router;
