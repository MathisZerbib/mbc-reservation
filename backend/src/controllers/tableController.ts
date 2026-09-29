import { Response } from 'express';
import { Server } from 'socket.io';

import { getLayout, saveLayout, deleteTable } from '../services/floorPlanService';
import { AuthRequest } from '../middleware/isAuthenticated';

/** Maps known validation errors to 400/409; everything else is a generic 500 (no internal leaks). */
const toStatus = (error: unknown): { status: number; message: string } => {
    const message = error instanceof Error ? error.message : '';
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
            const { tables, deleteIds } = req.body as { tables: unknown[]; deleteIds?: unknown[] };
            if (!Array.isArray(tables)) return res.status(400).json({ error: 'tables must be an array' });
            const layout = await saveLayout(tables, deleteIds ?? [], req.tenant!.id);
            io.emit('floor-plan-update', { tables: layout });
            res.json(layout);
        } catch (error) {
            console.error(error);
            const { status, message } = toStatus(error);
            res.status(status).json({ error: message });
        }
    },

    deleteTable: async (req: AuthRequest, res: Response) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid table id' });
            await deleteTable(id, req.tenant!.id);
            io.emit('floor-plan-update', { deletedId: id });
            res.json({ ok: true });
        } catch (error) {
            console.error(error);
            const { status, message } = toStatus(error);
            res.status(status).json({ error: message });
        }
    },
});
