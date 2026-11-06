import crypto from 'node:crypto';

/**
 * Server configuration read from the environment. No secret has a built-in fallback:
 * production refuses to start without one, and development generates a random,
 * per-process secret (sessions end when the dev server restarts) instead of a known string.
 */

type Env = Record<string, string | undefined>;

export const MIN_TOKEN_SECRET_LENGTH = 32;

export const isProduction = (env: Env = process.env) => env.NODE_ENV === 'production';

/** Returns the session-signing secret, or throws when it is missing or weak in production. */
export function resolveTokenSecret(env: Env = process.env): { secret: string; generated: boolean } {
  const secret = env.TOKEN_SECRET ?? '';
  if (secret.length >= MIN_TOKEN_SECRET_LENGTH) return { secret, generated: false };
  if (isProduction(env)) {
    throw new Error(
      secret
        ? `TOKEN_SECRET is too short (${secret.length} characters). Use at least ${MIN_TOKEN_SECRET_LENGTH} random characters.`
        : 'TOKEN_SECRET is not set. The server will not start in production without it.',
    );
  }
  return { secret: crypto.randomBytes(48).toString('hex'), generated: true };
}

let tokenSecret: string | null = null;
export function getTokenSecret(): string {
  if (tokenSecret === null) {
    const { secret, generated } = resolveTokenSecret();
    if (generated) console.warn('TOKEN_SECRET is not set: using a random development secret. Sessions end when the server restarts.');
    tokenSecret = secret;
  }
  return tokenSecret;
}

export type CashfreeConfig = {
  appId: string;
  secretKey: string;
  env: 'SANDBOX' | 'PRODUCTION';
  apiBase: string;
};

/** Cashfree settings, or null when payments are not configured (callers must fail closed). */
export function resolveCashfreeConfig(env: Env = process.env): CashfreeConfig | null {
  const appId = (env.CASHFREE_APP_ID ?? '').trim();
  const secretKey = (env.CASHFREE_SECRET_KEY ?? '').trim();
  if (!appId || !secretKey) return null;
  const mode = (env.CASHFREE_ENV ?? '').trim().toUpperCase();
  if (mode !== 'SANDBOX' && mode !== 'PRODUCTION') return null;
  return {
    appId, secretKey, env: mode,
    apiBase: mode === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
  };
}

/** Checks required settings at startup so a misconfigured deploy fails loudly, not at first sign-in. */
export function assertServerConfig(env: Env = process.env) {
  resolveTokenSecret(env);
  if (isProduction(env) && !env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  if (isProduction(env) && !resolveCashfreeConfig(env)) {
    console.warn('Cashfree is not configured (CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV). Payments are disabled.');
  }
}
