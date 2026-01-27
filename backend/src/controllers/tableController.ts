import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const tableController = {
    getAllTables: async (req: Request, res: Response) => {
        try {
            const tables = await prisma.table.findMany();
            res.json(tables);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};
