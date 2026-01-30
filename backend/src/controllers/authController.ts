import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include 'user'
interface AuthenticatedRequest extends Request {
  user?: any;
}
import bcrypt from 'bcryptjs';
import { generateTokens } from '../utils/jwt';
import {
  addRefreshTokenToWhitelist,
  findRefreshToken,
  deleteRefreshTokenById,
  revokeTokens,
} from '../services/authService';
import { findUserByEmail, createUserByEmailAndPassword, findUserById } from '../services/userService';
import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_ACCESS_SECRET!;

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
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
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
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
  },

  refreshToken: async (req: Request, res: Response, next: NextFunction) => {
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
  },

  revokeRefreshTokens: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;
      await revokeTokens(userId);
      res.json({ message: `Tokens revoked for user with id #${userId}` });
    } catch (err) {
      next(err);
    }
  },
};

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const existingUser = await findUserByEmail(email);
  if (!existingUser) return res.status(403).json({ error: 'Invalid login credentials.' });

  const validPassword = await bcrypt.compare(password, existingUser.password);
  if (!validPassword) return res.status(403).json({ error: 'Invalid login credentials.' });

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET_KEY));
  return res.json({ token });
}

export async function verifyToken(req: AuthenticatedRequest, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(403).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET_KEY));
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}