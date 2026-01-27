import { Router } from 'express';
import { tableController } from '../controllers/tableController';

const router = Router();

router.get('/tables', tableController.getAllTables);

export default router;
