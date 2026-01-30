// Example: backend/src/routes/protectedRoutes.ts
import { Router } from 'express';
import { verifyToken } from '../controllers/authController';

const router = Router();

router.get('/protected', verifyToken, (req, res) => {
  res.json({ ok: true });
});

export default router;