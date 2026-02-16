import { Request, Response } from 'express';
import { fullBook } from '../services/fullBookService';

export async function fullBookController(req: Request, res: Response) {
    try {
        const { date, number } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
        }
        const num = number ? parseInt(number.toString()) : undefined;
        await fullBook(date, num);
        res.json({ message: 'Full booking completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to perform full booking' });
    }
}