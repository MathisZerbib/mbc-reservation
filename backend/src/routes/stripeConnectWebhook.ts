import { Router, Request, Response } from 'express';
import { handleConnectWebhook } from '../services/stripeConnectService';

// Mounted at EXACTLY /api/webhooks/stripe-connect with express.raw() in
// server.ts (raw body required for signature verification, and scoping raw
// parsing to this prefix avoids breaking JSON parsing on other /api routes).
const router = Router();

/**
 * @swagger
 * tags:
 *   name: StripeConnectWebhook
 *   description: Single platform webhook for all Stripe Connect events
 */

/**
 * @swagger
 * /webhooks/stripe-connect:
 *   post:
 *     summary: Centralized Stripe Connect webhook (all restaurants, one secret)
 *     tags: [StripeConnectWebhook]
 *     responses:
 *       200:
 *         description: Event received, replayed, or safely dropped
 *       400:
 *         description: Invalid signature or misconfigured secret
 */

// Security contract (plain comment: swagger-jsdoc parses the block above as
// YAML, so no prose, braces, or list markers may live inside it):
// - Single STRIPE_CONNECT_WEBHOOK_SECRET, no per-restaurant secrets.
// - Tenant binding via event.account vs RestaurantSettings.stripeAccountId.
// - 200 for well-signed events (even duplicates/mismatches); 400 only for
//   signature failures / misconfiguration.
// NOTE: mounted with express.raw() in server.ts BEFORE express.json(),
// otherwise signature verification always fails.
router.post('/', async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    try {
        const outcome = await handleConnectWebhook(req.body as Buffer, signature);
        res.json({ received: true, outcome });
    } catch (e) {
        const code = (e as any)?.code;
        if (code === 'INVALID_SIGNATURE') {
            // Log + alert surface: signature failures are either attacks or a
            // rotated secret — both need human eyes immediately.
            console.error('[stripe-connect] 🚨 webhook signature failure — check STRIPE_CONNECT_WEBHOOK_SECRET rotation / possible forgery.');
            res.status(400).json({ error: 'Invalid webhook signature' });
            return;
        }
        console.error('[stripe-connect] webhook misconfigured:', (e as Error).message);
        res.status(500).json({ error: 'Webhook misconfigured' });
    }
});

export default router;
