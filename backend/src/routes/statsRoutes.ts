import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { countCustomerTenants } from '../services/tenantService';

const router = Router();

/** Page-view traffic, not a hot path: generous per-IP budget, JSON 429. */
const statsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    },
});

/**
 * The landing page shows this number, so it changes rarely and a count is
 * cheap: one in-process cache entry keeps a page-view spike off the database.
 */
const CACHE_TTL_MS = 60 * 1000;
let cache: { count: number; expiresAt: number } | null = null;

async function onboardedCount(): Promise<number> {
    if (cache && cache.expiresAt > Date.now()) return cache.count;
    const count = await countCustomerTenants();
    cache = { count, expiresAt: Date.now() + CACHE_TTL_MS };
    return count;
}

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: Public counters shown on the landing page
 */

/**
 * @swagger
 * /stats/restaurants:
 *   get:
 *     summary: Number of restaurants onboarded (excluding sandboxes)
 *     description: >
 *       Public marketing counter. Counts real tenants only — the seed and demo
 *       tenants are excluded via SANDBOX_TENANT_SLUGS. Keep the free-for-life
 *       claim in sync with LIFETIME_FREE_SLOTS.
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Counter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 3
 *       429:
 *         description: Rate limited
 */
router.get('/stats/restaurants', statsLimiter, async (_req, res: Response) => {
    try {
        // Cheap and cacheable at the edge: the value only moves on signups.
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ count: await onboardedCount() });
    } catch (err) {
        console.error('Failed to count onboarded restaurants:', err);
        res.status(503).json({ error: 'Counter unavailable.' });
    }
});

export default router;
