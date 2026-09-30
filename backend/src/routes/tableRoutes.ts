import { Router, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { tableController } from '../controllers/tableController';
import { isAuthenticated, requireTenant, requireActiveTrial, resolveTenantFromSlug } from '../middleware/isAuthenticated';
import { floorPlanUpload } from '../middleware/upload';
import { aiAnalyzeLimiter } from '../middleware/rateLimit';

export const tableRoutes = (io: Server) => {
    const router = Router();
    const controller = tableController(io);

    /**
     * @swagger
     * tags:
     *   name: Tables
     *   description: Table management
     */

    /**
     * @swagger
     * /tables:
     *   get:
     *     summary: Retrieve the full table layout (geometry + adjacency)
     *     tags: [Tables]
     *     responses:
     *       200:
     *         description: The table layout
     */
    router.get('/tables', resolveTenantFromSlug, controller.getAllTables);

    /**
     * @swagger
     * /tables/layout:
     *   put:
     *     summary: Replace the full table layout (geometry + manual adjacency)
     *     tags: [Tables]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: The saved table layout
     */
    router.put('/tables/layout', isAuthenticated, requireTenant, requireActiveTrial, controller.saveLayout);
    router.delete('/tables/:id', isAuthenticated, requireTenant, requireActiveTrial, controller.deleteTable);

    /**
     * @swagger
     * /tables/analyze-image:
     *   post:
     *     summary: Detect tables from a floor-plan image with Gemini Vision (returns a review draft, never writes)
     *     tags: [Tables]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: AI table draft + warnings
     */
    router.post(
        '/tables/analyze-image',
        isAuthenticated,
        requireTenant,
        requireActiveTrial,
        aiAnalyzeLimiter,
        (req: Request, res: Response, next: NextFunction) => {
            // Optional file: falls through to { imageUrl } JSON body when absent.
            floorPlanUpload.single('image')(req, res, (err: unknown) => {
                if (err) {
                    const message = err instanceof Error ? err.message : 'Upload failed';
                    const status = /file|image|only/i.test(message) ? 400 : 500;
                    return res.status(status).json({ error: message });
                }
                next();
            });
        },
        controller.analyzeFloorPlanImage,
    );

    return router;
};
