import crypto from 'crypto';
import { getTokenSecret } from './config';

// Session tokens: base64url(JSON payload) + "." + HMAC-SHA256 signature. Only this server
// signs and checks them, so a shared-secret HMAC is the right algorithm (no "alg" header to forge).
const ISSUER = 'snapcontact-api';
const AUDIENCE = 'snapcontact-app';

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
}

function sign(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

export function createToken(payload: object, expiresInMs: number, secret = getTokenSecret()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, iss: ISSUER, aud: AUDIENCE, exp: Date.now() + expiresInMs })).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload, or null for a malformed, forged, expired or foreign token. */
export function verifyToken(token: string, secret = getTokenSecret()): any | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const given = Buffer.from(sig);
  const expected = Buffer.from(sign(body, secret));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload?.exp !== 'number' || Date.now() > payload.exp) return null;
    if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
    return payload;
  } catch { return null; }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
