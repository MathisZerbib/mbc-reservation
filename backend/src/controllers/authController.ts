import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/isAuthenticated';

// Extend Express Request type to include 'user'
interface AuthenticatedRequest extends Request {
  user?: any;
}
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateTokens } from '../utils/jwt';
import { verifyTurnstile } from '../utils/turnstile';
import { signVerificationToken, verifyVerificationToken } from '../utils/verification';
import { createTenant, findTenantBySlug } from '../services/tenantService';
import { emailService } from '../services/emailService';
import {
  addRefreshTokenToWhitelist,
  findRefreshToken,
  deleteRefreshTokenById,
  revokeTokens,
} from '../services/authService';
import { findUserByEmail, createUserByEmailAndPassword, findUserById, markEmailVerified } from '../services/userService';
import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_ACCESS_SECRET!;

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, restaurantName, turnstileToken } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'You must provide an email and a password.' });
      if (!restaurantName || String(restaurantName).trim().length < 2) {
        return res.status(400).json({ error: 'You must provide your restaurant name.' });
      }
      if (String(password).length < 12) {
        return res.status(400).json({ error: 'Password must be at least 12 characters.' });
      }

      const human = await verifyTurnstile({ token: turnstileToken, remoteIp: req.ip, expectedAction: 'signup' });
      if (!human) return res.status(400).json({ error: 'Bot verification failed. Please try again.' });

      const existingUser = await findUserByEmail(email);
      if (existingUser) return res.status(400).json({ error: 'Email already in use.' });

      const tenant = await createTenant(String(restaurantName));
      const user = await createUserByEmailAndPassword({ email, password, tenantId: tenant.id });

      // Fire-and-forget: registration succeeds even if the mail provider is down.
      const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${signVerificationToken(user.id)}`;
      emailService.sendVerificationEmail(email, link).catch((e: unknown) => console.error(e));

      // No tokens yet — the account activates on email verification.
      res.status(201).json({
        message: 'Account created. Please check your inbox to verify your email.',
        tenant: { slug: tenant.slug, trialEndsAt: tenant.trialEndsAt },
      });
    } catch (err) {
      next(err);
    }
  },

  verifyEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Missing verification token.' });

      let userId: string;
      try {
        userId = verifyVerificationToken(String(token));
      } catch {
        return res.status(400).json({ error: 'Invalid or expired verification link.' });
      }

      const user = await findUserById(userId);
      if (!user) return res.status(400).json({ error: 'Invalid or expired verification link.' });
      if (!user.emailVerified) await markEmailVerified(user.id);

      const tenant = await prisma.tenant.findFirst({ where: { users: { some: { id: userId } } } });
      const { accessToken, refreshToken } = generateTokens(user);
      await addRefreshTokenToWhitelist({ refreshToken, userId: user.id });

      res.json({ accessToken, refreshToken, tenant: tenant ? { slug: tenant.slug, trialEndsAt: tenant.trialEndsAt } : null });
    } catch (err) {
      next(err);
    }
  },

  resendVerification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      // Always 200 — never reveal whether an address is registered.
      if (email) {
        const user = await findUserByEmail(String(email));
        if (user && !user.emailVerified) {
          const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${signVerificationToken(user.id)}`;
          await emailService.sendVerificationEmail(user.email, link);
        }
      }
      res.json({ message: 'If an unverified account exists for this email, a new link is on its way.' });
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

      if (!existingUser.emailVerified) {
        return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
      }

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

  demoLogin: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Interim demo access: shared demo user with an unguessable password.
      // Password login for this account is effectively disabled (random secret,
      // never exposed). The demo account lives on its own sandbox tenant.
      const email = process.env.DEMO_EMAIL || 'demo@example.com';
      let user = await findUserByEmail(email);
      if (!user) {
        const { randomBytes } = await import('crypto');
        let demoTenant = await findTenantBySlug('demo');
        if (!demoTenant) demoTenant = await createTenant('Demo Restaurant', 365);
        user = await createUserByEmailAndPassword({
          email,
          password: randomBytes(32).toString('base64url'),
          tenantId: demoTenant.id,
        });
        // Pre-verified: password login is disabled anyway, but the address is
        // kept in a usable state for anyone inspecting the sandbox tenant.
        await markEmailVerified(user.id);
      }
      // Sandbox account: pre-onboarded on every login, not just at creation.
      // The flag only lives on the tenant, so a tenant that predates the column
      // or was reset elsewhere would otherwise bounce the demo to /onboarding
      // forever. Idempotent, and scoped to the demo tenant only.
      if (user.tenantId) {
        await prisma.tenant.updateMany({
          where: { id: user.tenantId, onboardingComplete: false },
          data: { onboardingComplete: true },
        });
      }
      const { accessToken, refreshToken } = generateTokens(user, { isDemo: true });
      await addRefreshTokenToWhitelist({ refreshToken, userId: user.id });
      res.json({ accessToken, refreshToken });
    } catch (err) {
      next(err);
    }
  },

  revokeRefreshTokens: async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Self-only: the user id comes from the verified access token, never the body.
      const userId = (req as AuthRequest).payload?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      await revokeTokens(userId);
      res.json({ message: `Tokens revoked for user with id #${userId}` });
    } catch (err) {
      next(err);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).payload?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const user = await findUserById(userId);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      res.json({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId });
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
    .setExpirationTime('6h')
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