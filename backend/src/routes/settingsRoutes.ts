import { Router } from 'express';
import { Server } from 'socket.io';
import { settingsController } from '../controllers/settingsController';
import { isAuthenticated, requireTenant, requireActiveTrial, requireRole } from '../middleware/isAuthenticated';
import { handleFloorPlanUpload } from '../middleware/uploadHandler';

export const settingsRoutes = (io: Server) => {
    const router = Router();
    const controller = settingsController(io);

    /**
     * @swagger
     * tags:
     *   name: Settings
     *   description: Tenant restaurant settings
     */

    router.get('/settings', isAuthenticated, requireTenant, controller.getSettings);
    router.patch('/settings', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), controller.patchSettings);
    router.post(
        '/settings/floor-plan-image',
        isAuthenticated,
        requireTenant,
        requireActiveTrial,
        requireRole('OWNER'),
        handleFloorPlanUpload,
        controller.uploadFloorPlanImage,
    );
    router.delete('/settings/floor-plan-image', isAuthenticated, requireTenant, requireActiveTrial, requireRole('OWNER'), controller.deleteFloorPlanImage);

    return router;
};
