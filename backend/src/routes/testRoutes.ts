import { Router } from 'express';
import { fullBookController } from '../controllers/fullbookController';

const router = Router();

router.post('/fullbook', fullBookController);

export default router;