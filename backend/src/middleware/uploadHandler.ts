import { Request, Response, NextFunction } from 'express';

import { floorPlanUpload } from './upload';

/**
 * Optional-file upload gate for floor-plan images: runs multer, maps
 * file errors to 400 (client) vs 500 (server), then falls through so
 * handlers can also accept a JSON { imageUrl } body when no file is sent.
 */
export const handleFloorPlanUpload = (req: Request, res: Response, next: NextFunction) => {
    floorPlanUpload.single('image')(req, res, (err: unknown) => {
        if (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            const status = /file|image|only/i.test(message) ? 400 : 500;
            return res.status(status).json({ error: message });
        }
        next();
    });
};
