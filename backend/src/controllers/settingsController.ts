import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { emitToTenant } from '../lib/tenantSocket';

import { getSettings, updateSettings, setFloorPlanImageUrl } from '../services/settingsService';
import { AuthRequest } from '../middleware/isAuthenticated';
import { FLOOR_PLAN_UPLOAD_DIR } from '../middleware/upload';
import { deleteFloorPlanUrl, isCloudinaryUrl, uploadFloorPlanBuffer } from '../lib/cloudinary';

/** Best-effort removal of the previous upload (local file or Cloudinary asset). */
const removePreviousUpload = (previousUrl: string | null) => {
    if (!previousUrl) return;
    if (isCloudinaryUrl(previousUrl)) {
        void deleteFloorPlanUrl(previousUrl);
        return;
    }
    if (!previousUrl.startsWith('/uploads/floor-plans/')) return;
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
            const updated = await updateSettings(req.tenant!.id, {
                avgTicket: (req.body as any)?.avgTicket,
                avgTicketLunch: (req.body as any)?.avgTicketLunch,
                avgTicketDinner: (req.body as any)?.avgTicketDinner,
                retentionMonths: (req.body as any)?.retentionMonths,
                lateGraceMinutes: (req.body as any)?.lateGraceMinutes,
                autoCancelLate: (req.body as any)?.autoCancelLate,
                depositEnabled: (req.body as any)?.depositEnabled,
                depositMinSize: (req.body as any)?.depositMinSize,
                depositAmount: (req.body as any)?.depositAmount,
                openHours: (req.body as any)?.openHours,
                tableTurnoverMinutes: (req.body as any)?.tableTurnoverMinutes,
            });
            emitToTenant(io, req.tenant!.id, 'settings-update', { settings: updated });
            res.json(updated);
        } catch (error) {
            console.error(error);
            if (error instanceof Error && /avgTicket|Lunch|Dinner|retentionMonths|lateGraceMinutes|autoCancelLate|depositEnabled|depositMinSize|depositAmount|openHours|tableTurnoverMinutes/.test(error.message)) {
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
            let url: string;
            if (file.buffer) {
                // Production: stream to Cloudinary, store the absolute CDN URL.
                const uploaded = await uploadFloorPlanBuffer(file.buffer, file.mimetype);
                url = uploaded.url;
            } else {
                // Local-dev disk fallback.
                url = `/uploads/floor-plans/${file.filename}`;
            }
            const updated = await setFloorPlanImageUrl(req.tenant!.id, url);
            removePreviousUpload(previous.floorPlanImageUrl);
            emitToTenant(io, req.tenant!.id, 'settings-update', { settings: updated });
            res.json(updated);
        } catch (error) {
            console.error(error);
            if (error instanceof Error && /Cloudinary is not configured|Only JPEG/.test(error.message)) {
                return res.status(400).json({ error: error.message });
            }
            // Clean up the stored file if the DB write failed.
            const file = (req as any).file as Express.Multer.File | undefined;
            if (file && !(file as any).buffer) fs.unlink(path.join(FLOOR_PLAN_UPLOAD_DIR, file.filename), () => undefined);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    deleteFloorPlanImage: async (req: AuthRequest, res: Response) => {
        try {
            const previous = await getSettings(req.tenant!.id);
            const updated = await setFloorPlanImageUrl(req.tenant!.id, null);
            removePreviousUpload(previous.floorPlanImageUrl);
            emitToTenant(io, req.tenant!.id, 'settings-update', { settings: updated });
            res.json(updated);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
});
