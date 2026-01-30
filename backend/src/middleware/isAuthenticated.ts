import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Request to include session for admin check
interface AdminSessionRequest extends Request {
  session?: {
    isAdmin?: boolean;
    [key: string]: any;
  };
}
export interface AuthRequest extends Request {
  payload?: any;
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



// export function requireAdmin(req: AdminSessionRequest, res: Response, next: NextFunction) {
//   if (req.session && req.session.isAdmin) return next();
//   res.status(401).json({ error: 'Unauthorized' });
// }