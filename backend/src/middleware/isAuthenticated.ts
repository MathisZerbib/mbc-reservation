import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { isTrialActive } from '../services/tenantService';

// Extend Request to include session for admin check
interface AdminSessionRequest extends Request {
  session?: {
    isAdmin?: boolean;
    [key: string]: any;
  };
}
export interface AuthRequest extends Request {
  payload?: any;
  tenant?: {
    id: string;
    slug: string;
    name: string;
    trialEndsAt: Date;
    onboardingComplete: boolean;
  };
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authorization.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string);
    req.payload = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err.name === 'TokenExpiredError' ? err.name : 'Unauthorized' });
  }
}

// Resolves the caller's tenant from the verified JWT (user → tenant).
// Must run after isAuthenticated. All tenant data access goes through req.tenant.
export async function requireTenant(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.payload?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user || !user.tenant) return res.status(403).json({ error: 'No restaurant attached to this account' });
    req.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
      trialEndsAt: user.tenant.trialEndsAt,
      onboardingComplete: user.tenant.onboardingComplete,
    };
    next();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Blocks writes when the trial expired. Must run after requireTenant
// (or resolveTenantFromSlug for public routes).
export function requireActiveTrial(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.tenant) return res.status(401).json({ error: 'Unauthorized' });
  if (!isTrialActive(req.tenant.trialEndsAt)) {
    return res.status(403).json({ error: 'Trial expired. Please subscribe to continue.' });
  }
  next();
}

// Public-route tenant resolution via ?slug= or body.slug (guest booking pages).
export async function resolveTenantFromSlug(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const slug = (req.query.slug as string | undefined) ?? (req.body as any)?.slug;
    if (!slug) return res.status(400).json({ error: 'Missing restaurant slug' });
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return res.status(404).json({ error: 'Unknown restaurant' });
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      trialEndsAt: tenant.trialEndsAt,
      onboardingComplete: tenant.onboardingComplete,
    };
    next();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Allows only demo sessions (access tokens carrying `isDemo: true`,
// issued by POST /auth/demo). Must run after isAuthenticated.
export function requireDemo(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.payload?.isDemo !== true) {
    return res.status(403).json({ error: 'Demo account required' });
  }
  next();
}

/**
 * Role gate: OWNER-only by default. Must run after isAuthenticated
 * (role is read from the user row, so it survives token staleness).
 * STAFF keeps live-ops access (bookings, placement, check-in); everything
 * structural (settings, layout, erasure, team) requires OWNER.
 */
export function requireRole(role: 'OWNER' | 'STAFF' = 'OWNER') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.payload?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      if (role === 'OWNER' && user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Owner access required' });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}



// export function requireAdmin(req: AdminSessionRequest, res: Response, next: NextFunction) {
//   if (req.session && req.session.isAdmin) return next();
//   res.status(401).json({ error: 'Unauthorized' });
// }