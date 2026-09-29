import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';

import { getSettings, updateSettings, setFloorPlanImageUrl } from '../services/settingsService';
import { AuthRequest } from '../middleware/isAuthenticated';
import { FLOOR_PLAN_UPLOAD_DIR } from '../middleware/upload';

/** Best-effort removal of the previous local upload (basename-guarded). */
const removePreviousUpload = (previousUrl: string | null) => {
    if (!previousUrl || !previousUrl.startsWith('/uploads/floor-plans/')) return;
    const file = path.join(FLOOR_PLAN_UPLOAD_DIR, path.basename(previousUrl));
    fs.unlink(file, () => undefined);
};

export const settingsController = (io: Server) => ({
    getSettings: async (req: AuthRequest, res: Response) => {
        try {
            res.json(await getSettings(req.tenant!.id));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    patchSettings: async (req: AuthRequest, res: Response) => {
        try {
            const updated = await updateSettings(req.tenant!.id, { avgTicket: (req.body as any)?.avgTicket });
            io.emit('settings-update', { settings: updated });
            res.json(updated);
        } catch (error) {
            console.error(error);
            if (error instanceof Error && /avgTicket/.test(error.message)) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    uploadFloorPlanImage: async (req: AuthRequest, res: Response) => {
        try {
            const file = (req as any).file as Express.Multer.File | undefined;
            if (!file) return res.status(400).json({ error: 'No image file provided' });

            const previous = await getSettings(req.tenant!.id);
            const url = `/uploads/floor-plans/${file.filename}`;
            const updated = await setFloorPlanImageUrl(req.tenant!.id, url);
            removePreviousUpload(previous.floorPlanImageUrl);
            io.emit('settings-update', { settings: updated });
            res.json(updated);
        } catch (error) {
            console.error(error);
            // Clean up the stored file if the DB write failed.
            const file = (req as any).file as Express.Multer.File | undefined;
            if (file) fs.unlink(path.join(FLOOR_PLAN_UPLOAD_DIR, file.filename), () => undefined);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
});
