import { Request, Response } from 'express';
import { Server } from 'socket.io';

import { getLayout, saveLayout, deleteTable } from '../services/floorPlanService';

const toStatus = (error: unknown): number => {
    const message = error instanceof Error ? error.message : '';
    if (/upcoming bookings/i.test(message)) return 409;
    if (/^(Table|Duplicate|Cannot delete|Invalid)/.test(message)) return 400;
    return 500;
};

export const tableController = (io: Server) => ({
    getAllTables: async (_req: Request, res: Response) => {
        try {
            res.json(await getLayout());
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    saveLayout: async (req: Request, res: Response) => {
        try {
            const { tables, deleteIds } = req.body as { tables: unknown[]; deleteIds?: unknown[] };
            if (!Array.isArray(tables)) return res.status(400).json({ error: 'tables must be an array' });
            const layout = await saveLayout(tables, deleteIds ?? []);
            io.emit('floor-plan-update', { tables: layout });
            res.json(layout);
        } catch (error) {
            console.error(error);
            res.status(toStatus(error)).json({
                error: error instanceof Error ? error.message : 'Failed to save layout',
            });
        }
    },

    deleteTable: async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid table id' });
            await deleteTable(id);
            io.emit('floor-plan-update', { deletedId: id });
            res.json({ ok: true });
        } catch (error) {
            console.error(error);
            res.status(toStatus(error)).json({
                error: error instanceof Error ? error.message : 'Failed to delete table',
            });
        }
    },
});
