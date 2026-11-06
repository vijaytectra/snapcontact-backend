import crypto from 'node:crypto';

/**
 * Email sign-in rules, kept free of Express and the database so they can be tested directly:
 *
 *   email -> checkEmail  -> 'password' -> loginWithPassword                      (no code)
 *                        -> 'otp'      -> requestCode -> verifyCode -> setPassword (first time)
 *   forgot password      -> forgotPassword -> verifyCode -> setPassword          (reset)
 *
 * Codes are 6 digits, hashed at rest, expire after 10 minutes, are deleted when used, and are
 * thrown away after too many wrong guesses. Answers never say whether an email is registered,
 * except that checkEmail sends accounts that already have a password to the password screen.
 */

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  verified: boolean;
  refreshToken: string | null;
  subscription: unknown;
};
export type AuthVerification = { email: string; otpHash: string; salt: string; expiresAt: string; magicToken: string | null };

export type AuthStore = {
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  findUserById(id: string): Promise<AuthUser | undefined>;
  insertUser(user: AuthUser): Promise<void>;
  updateUser(id: string, patch: Partial<AuthUser>): Promise<void>;
  saveVerification(v: AuthVerification): Promise<void>;
  findVerification(email: string): Promise<AuthVerification | undefined>;
  deleteVerification(email: string): Promise<void>;
};
export type AuthMailer = {
  sendOtp(to: string, otp: string): Promise<void>;
  sendMagicLink?(to: string, link: string): Promise<void>;
};
export type AuthDeps = {
  store: AuthStore;
  mailer: AuthMailer;
  hashPassword(password: string): { salt: string; hash: string };
  verifyPassword(password: string, salt: string, hash: string): boolean;
  createToken(payload: object, ttlMs: number): string;
  verifyToken(token: string): any | null;
  now?: () => number;
};

export class AuthError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const MIN_PASSWORD = 8;
const ACCESS_TTL = 15 * 60 * 1000;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;
// A password may be (re)set only with a session that proved email ownership this recently.
const SET_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

const BAD_CODE = 'That code is incorrect or has expired. Request a new code and try again.';
const BAD_LOGIN = 'Incorrect email or password.';

export function createAuthFlow(deps: AuthDeps) {
  const { store, mailer } = deps;
  const now = deps.now ?? Date.now;
  const codeFailures = new Map<string, number>();
  const loginFailures = new Map<string, { count: number; until: number }>();
  const key = (email: string) => email.trim().toLowerCase();
  // Same work for unknown emails, so response time does not reveal which accounts exist.
  const dummy = deps.hashPassword('');

  /** Accounts made by email code or Google start with the hash of an empty password. */
  const hasPassword = (user: AuthUser) => !deps.verifyPassword('', user.salt, user.passwordHash);

  function publicUser(user: AuthUser) {
    return { id: user.id, email: user.email, name: user.name, subscription: user.subscription };
  }

  async function startSession(user: AuthUser, via: 'otp' | 'password' | 'google') {
    const base = { userId: user.id, email: user.email };
    const token = deps.createToken({ ...base, type: 'access', via, at: now() }, ACCESS_TTL);
    const refreshToken = deps.createToken({ ...base, type: 'refresh' }, REFRESH_TTL);
    await store.updateUser(user.id, { verified: true, refreshToken });
    return { token, refreshToken, user: publicUser(user), needsPassword: !hasPassword(user) };
  }

  async function findOrCreateUser(email: string, name?: string) {
    const existing = await store.findUserByEmail(email);
    if (existing) return existing;
    const { salt, hash } = deps.hashPassword('');
    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : email.split('@')[0];
    const start = new Date(now());
    const user: AuthUser = {
      id: `usr_${now()}_${crypto.randomBytes(3).toString('hex')}`, email: email.trim(), name: cleanName,
      passwordHash: hash, salt, createdAt: start.toISOString(), verified: true, refreshToken: null,
      subscription: { status: 'trial', trialStartDate: start.toISOString(), trialEndDate: new Date(now() + 7 * 864e5).toISOString() },
    };
    await store.insertUser(user);
    return user;
  }

  async function sendCode(email: string) {
    const otp = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto.scryptSync(otp, salt, 64).toString('hex');
    const magicToken = crypto.randomBytes(24).toString('hex');
    await store.saveVerification({ email: email.trim(), otpHash, salt, expiresAt: new Date(now() + OTP_TTL_MS).toISOString(), magicToken });
    codeFailures.delete(key(email));
    try {
      await mailer.sendOtp(email.trim(), otp);
      await mailer.sendMagicLink?.(email.trim(), `snapcontact://verify?email=${encodeURIComponent(email.trim())}&token=${magicToken}`);
    } catch (e: any) {
      console.error('Email send failed:', e?.message);
    }
  }

  /** Checks a code and deletes it on success (single use), on expiry, or after too many wrong guesses. */
  async function consumeCode(email: string, otp: string) {
    const v = await store.findVerification(email);
    if (!v) throw new AuthError(400, BAD_CODE, 'BAD_CODE');
    if (new Date(v.expiresAt).getTime() < now()) {
      await store.deleteVerification(email);
      throw new AuthError(400, BAD_CODE, 'BAD_CODE');
    }
    const computed = crypto.scryptSync(String(otp), v.salt, 64);
    const stored = Buffer.from(v.otpHash, 'hex');
    if (computed.length !== stored.length || !crypto.timingSafeEqual(computed, stored)) {
      const failures = (codeFailures.get(key(email)) ?? 0) + 1;
      codeFailures.set(key(email), failures);
      if (failures >= MAX_CODE_ATTEMPTS) {
        codeFailures.delete(key(email));
        await store.deleteVerification(email);
        throw new AuthError(429, 'Too many wrong codes. Request a new code and try again.', 'CODE_LOCKED');
      }
      throw new AuthError(400, BAD_CODE, 'BAD_CODE');
    }
    codeFailures.delete(key(email));
    await store.deleteVerification(email);
  }

  return {
    hasPassword,
    startSession,
    findOrCreateUser,

    /** Which screen follows the email step. New emails and accounts without a password both get 'otp'. */
    async checkEmail(email: string): Promise<{ method: 'password' | 'otp' }> {
      const user = await store.findUserByEmail(email);
      if (!user) { deps.verifyPassword('', dummy.salt, dummy.hash); return { method: 'otp' }; }
      return { method: hasPassword(user) ? 'password' : 'otp' };
    },

    /** Emails a sign-in code. Works for new emails too: verifying the code creates the account. */
    async requestCode(email: string) {
      await sendCode(email);
      return { sent: true };
    },

    /** Emails a reset code only when the account exists, but answers the same either way. */
    async forgotPassword(email: string) {
      if (await store.findUserByEmail(email)) await sendCode(email);
      return { sent: true };
    },

    async verifyCode(email: string, otp: string, name?: string) {
      await consumeCode(email, otp);
      return startSession(await findOrCreateUser(email, name), 'otp');
    },

    async verifyLink(email: string, token: string) {
      const v = await store.findVerification(email);
      if (!v || !v.magicToken || v.magicToken.length !== token.length ||
          !crypto.timingSafeEqual(Buffer.from(v.magicToken), Buffer.from(token)) ||
          new Date(v.expiresAt).getTime() < now()) {
        throw new AuthError(400, 'This sign-in link is invalid or has expired.', 'BAD_LINK');
      }
      await store.deleteVerification(email);
      return startSession(await findOrCreateUser(email), 'otp');
    },

    async loginWithPassword(email: string, password: string) {
      const k = key(email);
      const lock = loginFailures.get(k);
      if (lock && lock.until > now() && lock.count >= MAX_LOGIN_FAILURES) {
        throw new AuthError(429, 'Too many failed sign-in attempts. Try again in 15 minutes or reset your password.', 'LOGIN_LOCKED');
      }
      const user = await store.findUserByEmail(email);
      const ok = user
        ? password.length > 0 && hasPassword(user) && deps.verifyPassword(password, user.salt, user.passwordHash)
        : (deps.verifyPassword(password, dummy.salt, dummy.hash), false);
      if (!user || !ok) {
        const prev = lock && lock.until > now() ? lock.count : 0;
        loginFailures.set(k, { count: prev + 1, until: now() + LOGIN_LOCK_MS });
        throw new AuthError(401, BAD_LOGIN, 'BAD_LOGIN');
      }
      loginFailures.delete(k);
      return startSession(user, 'password');
    },

    /**
     * Creates or replaces the password. Needs an access token from a code (or link) verified in
     * the last 15 minutes, so a stolen password session cannot change the password.
     */
    async setPassword(accessToken: string, password: string) {
      const payload = deps.verifyToken(accessToken);
      if (!payload || payload.type !== 'access') throw new AuthError(401, 'Your session has expired. Sign in again.', 'BAD_TOKEN');
      if (payload.via !== 'otp' || typeof payload.at !== 'number' || now() - payload.at > SET_PASSWORD_WINDOW_MS) {
        throw new AuthError(403, 'Verify your email again before changing your password.', 'REVERIFY');
      }
      if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 128) {
        throw new AuthError(400, `Use at least ${MIN_PASSWORD} characters.`, 'WEAK_PASSWORD');
      }
      const user = await store.findUserById(payload.userId);
      if (!user) throw new AuthError(401, 'Your session has expired. Sign in again.', 'BAD_TOKEN');
      const { salt, hash } = deps.hashPassword(password);
      await store.updateUser(user.id, { salt, passwordHash: hash });
      loginFailures.delete(key(user.email));
      // A fresh session replaces the old refresh token, signing out other devices.
      return startSession({ ...user, salt, passwordHash: hash }, 'password');
    },
  };
}

export type AuthFlow = ReturnType<typeof createAuthFlow>;
