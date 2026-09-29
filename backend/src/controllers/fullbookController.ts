import { Response } from 'express';
import { fullBook } from '../services/fullBookService';
import { AuthRequest } from '../middleware/isAuthenticated';

export async function fullBookController(req: AuthRequest, res: Response) {
    try {
        const { date, time, limit } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
        }

        const numLimit = limit ? parseInt(limit.toString()) : undefined;

        const result = await fullBook(date, time || '19:00', numLimit, req.tenant!.id);
        
        res.json({ 
            message: 'Full booking process completed',
            stats: result
        });
    } catch (error) {
        console.error('Fullbook Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
}