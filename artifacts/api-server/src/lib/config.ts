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

/**
 * Key that encrypts a password between sign-up and its credentials email (see sealedText.ts).
 * Returns null when unset. Production then disables username sign-up instead of storing anything in clear.
 */
export function resolveCredentialKey(env: Env = process.env): Buffer | null {
  const raw = (env.CREDENTIAL_KEY ?? '').trim();
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_KEY must be 32 random bytes, base64-encoded. Create one with: openssl rand -base64 32');
  }
  return key;
}

let credentialKey: Buffer | null | undefined;
export function getCredentialKey(): Buffer | null {
  if (credentialKey === undefined) {
    const key = resolveCredentialKey();
    if (!key && !isProduction()) {
      console.warn('CREDENTIAL_KEY is not set: using a random development key. Pending sign-ups end when the server restarts.');
      credentialKey = crypto.randomBytes(32);
    } else {
      credentialKey = key;
    }
  }
  return credentialKey;
}

/** Checks required settings at startup so a misconfigured deploy fails loudly, not at first sign-in. */
export function assertServerConfig(env: Env = process.env) {
  resolveTokenSecret(env);
  resolveCredentialKey(env);
  if (isProduction(env) && !env.CREDENTIAL_KEY) {
    console.warn('CREDENTIAL_KEY is not set: username sign-up is disabled until it is added.');
  }
  if (isProduction(env) && !env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  if (isProduction(env) && !resolveCashfreeConfig(env)) {
    console.warn('Cashfree is not configured (CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV). Payments are disabled.');
  }
}
