import { Router, Response } from 'express';
import { isAuthenticated, requireTenant, requireActiveTrial, requireRole, AuthRequest } from '../middleware/isAuthenticated';
import { prisma } from '../lib/prisma';
import { getSettings } from '../services/settingsService';
import { isStripeEnabled, createOnboardingLink, refreshOnboardingStatus, connectErrorResponse, stripeMode } from '../services/depositService';

const router = Router();

const appUrl = () =>
    (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * @swagger
 * tags:
 *   name: Stripe
 *   description: Deposits (Connect Express onboarding + status)
 */

/**
 * @swagger
 * /stripe/connect:
 *   post:
 *     summary: Create (or reuse) the restaurant Express account, return onboarding URL
 *     tags: [Stripe]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding link
 *       400:
 *         description: Stripe not configured
 */
router.post('/stripe/connect', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        if (!isStripeEnabled()) return res.status(400).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing)' });
        const tid = req.tenant!.id;
        const settings = await getSettings(tid);
        const owner = await prisma.user.findUnique({
            where: { id: req.payload?.userId },
            select: { email: true },
        });
        const base = appUrl();
        const link = await createOnboardingLink(
            tid,
            req.tenant!.name,
            owner?.email ?? null,
            { stripeAccountId: settings.stripeAccountId, stripeOnboarded: settings.stripeOnboarded },
            {
                returnUrl: `${base}/app/settings?stripe=done`,
                refreshUrl: `${base}/app/settings?stripe=refresh`,
            },
        );
        res.json(link);
    } catch (e) {
        console.error('Stripe connect failed:', (e as Error).message);
        const mapped = connectErrorResponse(e);
        res.status(mapped.status).json({ error: mapped.error });
    }
});

/**
 * @swagger
 * /stripe/status:
 *   get:
 *     summary: Stripe connection status for this restaurant
 *     tags: [Stripe]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection flags
 */
router.get('/stripe/status', isAuthenticated, requireTenant, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const tid = req.tenant!.id;
        const settings = await getSettings(tid);
        let onboarded = settings.stripeOnboarded;
        if (isStripeEnabled() && settings.stripeAccountId && !onboarded) {
            try {
                onboarded = await refreshOnboardingStatus(tid, {
                    stripeAccountId: settings.stripeAccountId,
                    stripeOnboarded: settings.stripeOnboarded,
                });
            } catch (e) {
                console.error('Stripe status refresh failed:', (e as Error).message);
            }
        }
        res.json({
            configured: isStripeEnabled(),
            mode: stripeMode(),
            accountId: settings.stripeAccountId,
            onboarded,
        });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
