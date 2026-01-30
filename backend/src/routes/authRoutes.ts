import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { generateTokens } from '../utils/jwt';
import {
  addRefreshTokenToWhitelist,
  findRefreshToken,
  deleteRefreshTokenById,
  revokeTokens,
} from '../services/authService';
import { findUserByEmail, createUserByEmailAndPassword, findUserById } from '../services/userService';

const router = Router();

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'You must provide an email and a password.' });

    const existingUser = await findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Email already in use.' });

    const user = await createUserByEmailAndPassword({ email, password });
    const { accessToken, refreshToken } = generateTokens(user);
    await addRefreshTokenToWhitelist({ refreshToken, userId: user.id });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'You must provide an email and a password.' });

    const existingUser = await findUserByEmail(email);
    if (!existingUser) return res.status(403).json({ error: 'Invalid login credentials.' });

    const validPassword = await bcrypt.compare(password, existingUser.password);
    if (!validPassword) return res.status(403).json({ error: 'Invalid login credentials.' });

    const { accessToken, refreshToken } = generateTokens(existingUser);
    await addRefreshTokenToWhitelist({ refreshToken, userId: existingUser.id });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refreshToken', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token.' });

    const savedRefreshToken = await findRefreshToken(refreshToken);
    if (
      !savedRefreshToken ||
      savedRefreshToken.revoked === true ||
      Date.now() >= savedRefreshToken.expireAt.getTime()
    ) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await findUserById(savedRefreshToken.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    await deleteRefreshTokenById(savedRefreshToken.id);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await addRefreshTokenToWhitelist({ refreshToken: newRefreshToken, userId: user.id });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/revokeRefreshTokens', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    await revokeTokens(userId);
    res.json({ message: `Tokens revoked for user with id #${userId}` });
  } catch (err) {
    next(err);
  }
});

export default router;