import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';

export interface AuthUser {
  userId: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    res.locals.user = {
      userId: payload.userId,
      role: payload.role as 'CUSTOMER' | 'PROVIDER' | 'ADMIN',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(
  ...allowedRoles: ('CUSTOMER' | 'PROVIDER' | 'ADMIN')[]
) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user || !allowedRoles.includes(res.locals.user.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
}