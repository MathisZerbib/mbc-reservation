import { Response } from 'express';
import { Server } from 'socket.io';
import { emitToTenant } from '../lib/tenantSocket';

import { getLayout, saveLayout, deleteTable } from '../services/floorPlanService';
import { AuthRequest } from '../middleware/isAuthenticated';

/** Maps known validation errors to 400/409; everything else is a generic 500 (no internal leaks). */
const toStatus = (error: unknown): { status: number; message: string; upcomingCount?: number } => {
    const message = error instanceof Error ? error.message : '';
    const upcoming = /UPCOMING_BOOKINGS:(\d+)/.exec(message);
    if (upcoming) {
        return {
            status: 409,
            message: 'Saving the floor plan will permanently delete all upcoming reservations. Confirm to proceed.',
            upcomingCount: Number(upcoming[1]),
        };
    }
    if (/upcoming bookings/i.test(message)) return { status: 409, message };
    if (/^(Table|Duplicate|Cannot delete|Invalid|avgTicket)/.test(message)) return { status: 400, message };
    return { status: 500, message: 'Internal server error' };
};

export const tableController = (io: Server) => ({
    getAllTables: async (req: AuthRequest, res: Response) => {
        try {
            res.json(await getLayout(req.tenant!.id));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    saveLayout: async (req: AuthRequest, res: Response) => {
        try {
            const { tables, deleteIds, confirmDeleteReservations } = req.body as {
                tables: unknown[];
                deleteIds?: unknown[];
                confirmDeleteReservations?: boolean;
            };
            if (!Array.isArray(tables)) return res.status(400).json({ error: 'tables must be an array' });
            const layout = await saveLayout(tables, deleteIds ?? [], req.tenant!.id, {
                confirmDeleteReservations: confirmDeleteReservations === true,
            });
            emitToTenant(io, req.tenant!.id, 'floor-plan-update', { tables: layout });
            emitToTenant(io, req.tenant!.id, 'booking-update', { type: 'layout-reset' });
            res.json(layout);
        } catch (error) {
            console.error(error);
            const { status, message, upcomingCount } = toStatus(error);
            res.status(status).json(upcomingCount !== undefined ? { error: message, upcomingCount } : { error: message });
        }
    },

    analyzeFloorPlanImage: async (req: AuthRequest, res: Response) => {
        try {
            const { analyzeFloorPlanImage } = await import('../services/floorPlanAiService.js');
            let buffer: Buffer | undefined;
            let mimetype = 'image/png';
            const file = (req as any).file as Express.Multer.File | undefined;
            if (file?.buffer) {
                buffer = file.buffer;
                mimetype = file.mimetype;
            } else if (typeof req.body?.imageUrl === 'string' && req.body.imageUrl.length > 0) {
                const imageUrl: string = req.body.imageUrl;
                if (!/^https?:\/\//.test(imageUrl) && !imageUrl.startsWith('/uploads/')) {
                    return res.status(400).json({ error: 'Invalid imageUrl' });
                }
                const absolute = imageUrl.startsWith('http')
                    ? imageUrl
                    : `${req.protocol}://${req.get('host')}${imageUrl}`;
                const fetched = await fetch(absolute);
                if (!fetched.ok) return res.status(400).json({ error: 'Could not fetch floor-plan image' });
                mimetype = fetched.headers.get('content-type')?.split(';')[0] || mimetype;
                buffer = Buffer.from(await fetched.arrayBuffer());
            } else {
                return res.status(400).json({ error: 'No image file or imageUrl provided' });
            }
            res.json(await analyzeFloorPlanImage(buffer, mimetype));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'AI analysis failed' });
        }
    },

    deleteTable: async (req: AuthRequest, res: Response) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid table id' });
            await deleteTable(id, req.tenant!.id);
            emitToTenant(io, req.tenant!.id, 'floor-plan-update', { deletedId: id });
            res.json({ ok: true });
        } catch (error) {
            console.error(error);
            const { status, message } = toStatus(error);
            res.status(status).json({ error: message });
        }
    },
});
