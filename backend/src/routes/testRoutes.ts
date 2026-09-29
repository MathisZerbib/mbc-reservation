import { Router } from 'express';
import { fullBookController } from '../controllers/fullbookController';
import { fullBookWithConsecutive } from '../services/fullBookService';
import { isAuthenticated, requireDemo, requireTenant, AuthRequest } from '../middleware/isAuthenticated';

const router = Router();

// Dev/demo helpers (bulk booking). Demo sessions only — never anonymous.
router.use(isAuthenticated, requireDemo, requireTenant);

router.post('/fullbook', fullBookController);

router.post('/auto-consec', async (req: AuthRequest, res) => {
    const { date } = req.body;

    if (!date) {
        res.status(400).json({ error: 'Date is required' });
        return;
    }

    try {
        const result = await fullBookWithConsecutive(
            date,
            '16:30',
            2,
            ['1', '10', '11', '12', '7', '4', '2'],
            3,
            'Auto-Consec',
            req.tenant!.id
        );
        res.json({
            message: 'Auto-consecutive booking completed',
            result
        });
    } catch (error) {
        console.error('Auto-consec error:', error);
        res.status(500).json({
            error: 'Failed to perform auto-consecutive booking',
            details: (error as Error).message
        });
    }
});

export default router;