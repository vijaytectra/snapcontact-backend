import crypto from 'node:crypto';
import { AuthError, MAX_CODE_ATTEMPTS, MIN_PASSWORD, OTP_TTL_MS, type AuthUser } from './authFlow';
import { isValidEmail } from './auth';
import { isValidUsername, normalizeUsername, USERNAME_RULES } from './username';

/**
 * Username sign-up, in four steps. Nothing can sign in until the last one.
 *
 *   register             username + password  -> registrationId (no account yet)
 *   requestCode          email                -> 6-digit code emailed to that address
 *   verifyCode           code                 -> account created and verified; credentials emailed
 *   resendCredentials    only when that email failed
 *
 * The account exists only after the code is confirmed. A sign-up never confirmed expires after
 * 24 hours and frees its username. Passwords are stored as scrypt hashes. A copy encrypted with
 * the server key is kept only until the credentials email is sent, because that email has to
 * contain the password.
 */

export const REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;
export const CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PASSWORD = 128;
const EMAIL_UNAVAILABLE = "This email address can't be used for a new account. Try a different email address.";
const USERNAME_TAKEN = 'That username is taken. Choose another.';
const ALREADY_VERIFIED = 'This account is already verified. Sign in with your username and password.';

export type RegistrationStatus = 'AWAITING_EMAIL' | 'AWAITING_CODE' | 'VERIFIED';
export type RegistrationRow = {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  passwordSealed: string | null;
  email: string | null;
  otpHash: string | null;
  otpSalt: string | null;
  otpExpiresAt: string | null;
  otpAttempts: number;
  codeSentAt: string | null;
  status: RegistrationStatus;
  userId: string | null;
  createdAt: string;
  expiresAt: string;
};

export type SignupStore = {
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  findUserByUsername(username: string): Promise<AuthUser | undefined>;
  findRegistration(id: string): Promise<RegistrationRow | undefined>;
  findRegistrationByUsername(username: string): Promise<RegistrationRow | undefined>;
  createRegistration(row: RegistrationRow): Promise<void>;
  updateRegistration(id: string, patch: Partial<RegistrationRow>): Promise<void>;
  /** Adds one wrong-or-right guess and returns the new count (atomic, so parallel guesses all count). */
  incrementOtpAttempts(id: string): Promise<number>;
  /** Clears the code only while it is still `otpHash`. False when another request already used it. */
  consumeOtp(id: string, otpHash: string): Promise<boolean>;
  /** Creates the user and marks the registration VERIFIED, in one transaction. */
  activateRegistration(id: string, user: AuthUser): Promise<void>;
  deleteRegistration(id: string): Promise<void>;
  deleteExpiredRegistrations(nowIso: string): Promise<void>;
};

export type SignupMailer = {
  sendOtp(to: string, otp: string): Promise<void>;
  sendCredentials(to: string, username: string, password: string): Promise<void>;
};

export type SignupDeps = {
  store: SignupStore;
  mailer: SignupMailer;
  hashPassword(password: string): { salt: string; hash: string };
  /** Encrypts the password for the credentials email. Throws when the server key is not set. */
  seal(plain: string): string;
  open(sealed: string): string;
  now?: () => number;
};

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === '23505';
const scryptHex = (value: string, salt: string) => crypto.scryptSync(value, salt, 64).toString('hex');

export function createSignupFlow(deps: SignupDeps) {
  const { store, mailer } = deps;
  const now = deps.now ?? Date.now;

  async function load(id: string): Promise<RegistrationRow> {
    const row = await store.findRegistration(id);
    if (!row || Date.parse(row.expiresAt) < now()) {
      throw new AuthError(404, 'This sign-up has expired. Start again.', 'REGISTRATION_NOT_FOUND');
    }
    return row;
  }

  /** Emails the credentials and, only on success, erases the stored copy of the password. */
  async function deliverCredentials(id: string): Promise<boolean> {
    const row = await store.findRegistration(id);
    if (!row || row.status !== 'VERIFIED' || !row.passwordSealed || !row.email) return false;
    let password: string;
    try {
      password = deps.open(row.passwordSealed);
    } catch {
      console.error('Credentials could not be decrypted for registration', id);
      return false;
    }
    try {
      await mailer.sendCredentials(row.email, row.username, password);
    } catch (e: any) {
      console.error('Credentials email failed:', e?.message);
      return false;
    }
    await store.deleteRegistration(id);
    return true;
  }

  return {
    /** Step 1: reserves the username and stores the password hash. Nothing is signed in yet. */
    async register(username: unknown, password: unknown) {
      await store.deleteExpiredRegistrations(new Date(now()).toISOString());
      const name = typeof username === 'string' ? normalizeUsername(username) : '';
      if (!isValidUsername(name)) throw new AuthError(400, USERNAME_RULES, 'INVALID_USERNAME');
      if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
        throw new AuthError(400, `Use at least ${MIN_PASSWORD} characters.`, 'WEAK_PASSWORD');
      }
      if (await store.findUserByUsername(name) || await store.findRegistrationByUsername(name)) {
        throw new AuthError(409, USERNAME_TAKEN, 'USERNAME_TAKEN');
      }
      const sealed = deps.seal(password); // 503 when the server key is not configured
      const { salt, hash } = deps.hashPassword(password);
      const created = new Date(now());
      const row: RegistrationRow = {
        id: crypto.randomBytes(24).toString('base64url'),
        username: name,
        passwordHash: hash,
        salt,
        passwordSealed: sealed,
        email: null,
        otpHash: null,
        otpSalt: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        codeSentAt: null,
        status: 'AWAITING_EMAIL',
        userId: null,
        createdAt: created.toISOString(),
        expiresAt: new Date(now() + REGISTRATION_TTL_MS).toISOString(),
      };
      try {
        await store.createRegistration(row);
      } catch (e) {
        // Two sign-ups for the same username at the same moment: the unique index lets one win.
        if (isUniqueViolation(e)) throw new AuthError(409, USERNAME_TAKEN, 'USERNAME_TAKEN');
        throw e;
      }
      return { registrationId: row.id, username: name, expiresAt: row.expiresAt };
    },

    /** Step 2: emails a 6-digit code to the address. Repeats wait out a 60-second cooldown. */
    async requestCode(registrationId: string, email: unknown) {
      const row = await load(registrationId);
      if (row.status === 'VERIFIED') throw new AuthError(409, ALREADY_VERIFIED, 'ALREADY_VERIFIED');
      const address = typeof email === 'string' ? email.trim() : '';
      if (!isValidEmail(address)) throw new AuthError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
      const waitMs = (row.codeSentAt ? Date.parse(row.codeSentAt) : 0) + CODE_RESEND_COOLDOWN_MS - now();
      if (waitMs > 0) {
        throw new AuthError(429, `Wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`, 'RESEND_COOLDOWN');
      }
      if (await store.findUserByEmail(address)) throw new AuthError(409, EMAIL_UNAVAILABLE, 'EMAIL_UNAVAILABLE');

      const otp = String(crypto.randomInt(100000, 1000000));
      const salt = crypto.randomBytes(16).toString('hex');
      // Sent before it is stored: a failed send leaves no cooldown, so the user can retry at once.
      try {
        await mailer.sendOtp(address, otp);
      } catch (e: any) {
        console.error('Sign-up code email failed:', e?.message);
        throw new AuthError(502, 'We could not send the code email. Check the address and try again.', 'EMAIL_DELIVERY_FAILED');
      }
      await store.updateRegistration(registrationId, {
        email: address,
        otpHash: scryptHex(otp, salt),
        otpSalt: salt,
        otpExpiresAt: new Date(now() + OTP_TTL_MS).toISOString(),
        otpAttempts: 0,
        codeSentAt: new Date(now()).toISOString(),
        status: 'AWAITING_CODE',
      });
      return { sent: true, resendAfterSeconds: CODE_RESEND_COOLDOWN_MS / 1000 };
    },

    /**
     * Step 3: checks the code. Expired, used and wrong codes are refused; after too many wrong
     * guesses the code is thrown away and a new one must be requested.
     */
    async verifyCode(registrationId: string, otp: unknown) {
      const row = await load(registrationId);
      if (row.status === 'VERIFIED') throw new AuthError(409, ALREADY_VERIFIED, 'ALREADY_VERIFIED');
      if (row.status !== 'AWAITING_CODE' || !row.otpHash || !row.otpSalt || !row.otpExpiresAt || !row.email) {
        throw new AuthError(400, 'Request a code first.', 'NO_CODE');
      }
      if (Date.parse(row.otpExpiresAt) < now()) {
        throw new AuthError(400, 'That code has expired. Request a new code.', 'CODE_EXPIRED');
      }
      const attempts = await store.incrementOtpAttempts(registrationId);
      if (attempts > MAX_CODE_ATTEMPTS) {
        await store.updateRegistration(registrationId, { otpHash: null, otpSalt: null, otpExpiresAt: null, status: 'AWAITING_EMAIL' });
        throw new AuthError(429, 'Too many wrong codes. Request a new code.', 'CODE_LOCKED');
      }
      const computed = Buffer.from(scryptHex(String(otp), row.otpSalt), 'hex');
      const stored = Buffer.from(row.otpHash, 'hex');
      if (computed.length !== stored.length || !crypto.timingSafeEqual(computed, stored)) {
        throw new AuthError(400, 'That code is incorrect. Check the email and try again.', 'BAD_CODE');
      }
      if (!(await store.consumeOtp(registrationId, row.otpHash))) {
        throw new AuthError(400, 'That code has already been used. Request a new code.', 'CODE_USED');
      }
      // The email or username may have been taken since the code was sent.
      if (await store.findUserByEmail(row.email)) throw new AuthError(409, EMAIL_UNAVAILABLE, 'EMAIL_UNAVAILABLE');
      if (await store.findUserByUsername(row.username)) throw new AuthError(409, USERNAME_TAKEN, 'USERNAME_TAKEN');

      const created = new Date(now());
      const user: AuthUser = {
        id: `usr_${now()}_${crypto.randomBytes(3).toString('hex')}`,
        email: row.email,
        username: row.username,
        name: row.username,
        passwordHash: row.passwordHash,
        salt: row.salt,
        createdAt: created.toISOString(),
        verified: true,
        refreshToken: null,
        subscription: {
          status: 'trial',
          trialStartDate: created.toISOString(),
          trialEndDate: new Date(now() + 7 * 864e5).toISOString(),
        },
      };
      try {
        await store.activateRegistration(registrationId, user);
      } catch (e) {
        if (isUniqueViolation(e)) throw new AuthError(409, 'That username or email can no longer be used. Start again.', 'CONFLICT');
        throw e;
      }
      const credentialsSent = await deliverCredentials(registrationId);
      return {
        verified: true,
        username: row.username,
        email: row.email,
        credentialsSent,
        ...(credentialsSent ? {} : { credentialsError: 'Your account is ready, but we could not email your credentials. Tap resend to try again.' }),
      };
    },

    /** Re-sends the credentials email after it failed. Only possible while the password copy is still held. */
    async resendCredentials(registrationId: string) {
      const row = await load(registrationId);
      if (row.status !== 'VERIFIED') throw new AuthError(409, 'Confirm your email code first.', 'NOT_VERIFIED');
      if (!(await deliverCredentials(registrationId))) {
        throw new AuthError(502, 'We could not email your credentials. Try again in a moment.', 'CREDENTIALS_EMAIL_FAILED');
      }
      return { sent: true };
    },
  };
}

export type SignupFlow = ReturnType<typeof createSignupFlow>;
