import { Router } from 'express';
import { Server } from 'socket.io';
import { tableController } from '../controllers/tableController';
import { isAuthenticated, requireTenant, requireActiveTrial, resolveTenantFromSlug, requireRole } from '../middleware/isAuthenticated';
import { handleFloorPlanUpload } from '../middleware/uploadHandler';
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
    router.put('/tables/layout', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), controller.saveLayout);
    router.delete('/tables/:id', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), controller.deleteTable);

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
        requireRole('OWNER'),
        aiAnalyzeLimiter,
        handleFloorPlanUpload,
        controller.analyzeFloorPlanImage,
    );

    return router;
};
