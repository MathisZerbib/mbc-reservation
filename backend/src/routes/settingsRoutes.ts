import { Router, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { settingsController } from '../controllers/settingsController';
import { isAuthenticated, requireTenant, requireActiveTrial } from '../middleware/isAuthenticated';
import { floorPlanUpload } from '../middleware/upload';

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
        (req: Request, res: Response, next: NextFunction) => {
            floorPlanUpload.single('image')(req, res, (err: unknown) => {
                if (err) {
                    const message = err instanceof Error ? err.message : 'Upload failed';
                    const status = /file|image|only/i.test(message) ? 400 : 500;
                    return res.status(status).json({ error: message });
                }
                next();
            });
        },
        controller.uploadFloorPlanImage,
    );
    router.delete('/settings/floor-plan-image', isAuthenticated, requireTenant, requireActiveTrial, controller.deleteFloorPlanImage);

    return router;
};
