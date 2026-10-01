import { Router } from 'express';
import { Server } from 'socket.io';
import { settingsController } from '../controllers/settingsController';
import { isAuthenticated, requireTenant, requireActiveTrial } from '../middleware/isAuthenticated';
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
    router.patch('/settings', isAuthenticated, requireTenant, requireActiveTrial, controller.patchSettings);
    router.post(
        '/settings/floor-plan-image',
        isAuthenticated,
        requireTenant,
        requireActiveTrial,
        handleFloorPlanUpload,
        controller.uploadFloorPlanImage,
    );
    router.delete('/settings/floor-plan-image', isAuthenticated, requireTenant, requireActiveTrial, controller.deleteFloorPlanImage);

    return router;
};
