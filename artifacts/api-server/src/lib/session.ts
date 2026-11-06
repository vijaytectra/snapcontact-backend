import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './auth';

export type AuthedRequest = Request & { userId: string };

/** The access token's user id, or null for a missing, forged or expired token. */
export function userIdFromRequest(req: Request): string | null {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.type === 'access' && typeof payload.userId === 'string' ? payload.userId : null;
}

/** Rejects requests without a valid access token; the user id never comes from the body. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = userIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Your session has expired. Sign in again.', code: 'BAD_TOKEN' });
  (req as AuthedRequest).userId = userId;
  return next();
}
