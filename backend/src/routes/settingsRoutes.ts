import { Router, Request, Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { settingsController } from '../controllers/settingsController';
import { isAuthenticated } from '../middleware/isAuthenticated';
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

    router.get('/settings', isAuthenticated, controller.getSettings);
    router.patch('/settings', isAuthenticated, controller.patchSettings);
    router.post(
        '/settings/floor-plan-image',
        isAuthenticated,
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

    return router;
};
