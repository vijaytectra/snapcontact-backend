// Run: node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSignupFlow, REGISTRATION_TTL_MS, CODE_RESEND_COOLDOWN_MS } from '../src/lib/signupFlow.ts';
import { createAuthFlow, AuthError, OTP_TTL_MS, MAX_CODE_ATTEMPTS, MAX_LOGIN_FAILURES } from '../src/lib/authFlow.ts';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../src/lib/auth.ts';
import { sealWith, openWith } from '../src/lib/sealedText.ts';

const KEY = crypto.randomBytes(32);
const lower = (s) => s.trim().toLowerCase();
const uniqueViolation = () => Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });

function setup() {
  const users = new Map();
  const regs = new Map();
  const mail = [];
  const fail = { otp: false, credentials: false };
  let clock = Date.parse('2026-11-06T10:00:00Z');

  const store = {
    async findUserByEmail(e) { return [...users.values()].find((u) => lower(u.email) === lower(e)); },
    async findUserByUsername(n) { return [...users.values()].find((u) => u.username === lower(n)); },
    async findUserById(id) { return users.get(id); },
    async insertUser(u) { users.set(u.id, { ...u }); },
    async updateUser(id, patch) { users.set(id, { ...users.get(id), ...patch }); },
    async saveVerification() {},
    async findVerification() {},
    async deleteVerification() {},
    // Username sign-up storage.
    async findRegistration(id) { return regs.has(id) ? { ...regs.get(id) } : undefined; },
    async findRegistrationByUsername(n) {
      const r = [...regs.values()].find((x) => x.username === lower(n));
      return r ? { ...r } : undefined;
    },
    async createRegistration(row) {
      if ([...regs.values()].some((r) => r.username === row.username)) throw uniqueViolation();
      regs.set(row.id, { ...row });
    },
    async updateRegistration(id, patch) { regs.set(id, { ...regs.get(id), ...patch }); },
    async incrementOtpAttempts(id) {
      const r = regs.get(id);
      r.otpAttempts += 1;
      return r.otpAttempts;
    },
    async consumeOtp(id, otpHash) {
      const r = regs.get(id);
      if (!r || r.otpHash !== otpHash || r.status !== 'AWAITING_CODE') return false;
      Object.assign(r, { otpHash: null, otpSalt: null, otpExpiresAt: null });
      return true;
    },
    async activateRegistration(id, user) {
      if ([...users.values()].some((u) => lower(u.email) === lower(user.email) || u.username === user.username)) {
        throw uniqueViolation();
      }
      users.set(user.id, { ...user });
      regs.set(id, { ...regs.get(id), status: 'VERIFIED', userId: user.id });
    },
    async deleteRegistration(id) { regs.delete(id); },
    async deleteExpiredRegistrations(nowIso) {
      for (const [id, r] of regs) if (Date.parse(r.expiresAt) < Date.parse(nowIso)) regs.delete(id);
    },
  };

  const signup = createSignupFlow({
    store,
    mailer: {
      async sendOtp(to, otp) {
        if (fail.otp) throw new Error('smtp unavailable');
        mail.push({ kind: 'otp', to, otp });
      },
      async sendCredentials(to, username, password) {
        if (fail.credentials) throw new Error('smtp unavailable');
        mail.push({ kind: 'credentials', to, username, password });
      },
    },
    hashPassword,
    seal: (plain) => sealWith(plain, KEY),
    open: (sealed) => openWith(sealed, KEY),
    now: () => clock,
  });

  const auth = createAuthFlow({
    store,
    mailer: { sendOtp: async () => {} },
    hashPassword, verifyPassword, createToken, verifyToken,
    now: () => clock,
  });

  return {
    store, signup, auth, users, regs, mail, fail,
    lastCode: () => mail.filter((m) => m.kind === 'otp').at(-1).otp,
    advance: (ms) => { clock += ms; },
  };
}

const rejects = (promise, code) => assert.rejects(promise, (e) => e instanceof AuthError && e.code === code);

/** Registers and confirms an email, returning the registration id. */
async function startSignup(t, { username = 'Akash_42', password = 'correct horse 1', email = 'akash@example.com' } = {}) {
  const { registrationId } = await t.signup.register(username, password);
  await t.signup.requestCode(registrationId, email);
  return registrationId;
}

test('register stores a scrypt hash and an encrypted copy, and creates no account yet', async () => {
  const t = setup();
  const { registrationId, username } = await t.signup.register('Akash_42', 'correct horse 1');
  assert.equal(username, 'akash_42', 'usernames are stored lower-cased');
  assert.equal(t.users.size, 0, 'nothing can sign in before the email is verified');

  const row = t.regs.get(registrationId);
  assert.ok(!JSON.stringify(row).includes('correct horse 1'), 'the plain password is not stored');
  assert.equal(openWith(row.passwordSealed, KEY), 'correct horse 1', 'the encrypted copy opens with the server key');
  assert.ok(verifyPassword('correct horse 1', row.salt, row.passwordHash));
});

test('duplicate usernames are refused, ignoring case, while a sign-up is pending too', async () => {
  const t = setup();
  await t.signup.register('Akash_42', 'correct horse 1');
  await rejects(t.signup.register('akash_42', 'another password'), 'USERNAME_TAKEN');

  // Once a user exists with that name, a new sign-up is refused as well.
  await startSignup(t, { username: 'taken_name', email: 'first@example.com' });
  const id = [...t.regs.keys()].find((k) => t.regs.get(k).username === 'taken_name');
  await t.signup.verifyCode(id, t.lastCode());
  await rejects(t.signup.register('TAKEN_NAME', 'correct horse 1'), 'USERNAME_TAKEN');
});

test('invalid usernames and short passwords are refused before anything is stored', async () => {
  const t = setup();
  await rejects(t.signup.register('ab', 'correct horse 1'), 'INVALID_USERNAME');
  await rejects(t.signup.register('has space', 'correct horse 1'), 'INVALID_USERNAME');
  await rejects(t.signup.register('good_name', 'short'), 'WEAK_PASSWORD');
  assert.equal(t.regs.size, 0);
});

test('an unverified sign-up cannot log in, and the answer is the same as a wrong password', async () => {
  const t = setup();
  await t.signup.register('akash_42', 'correct horse 1');
  await rejects(t.auth.loginWithUsername('akash_42', 'correct horse 1'), 'BAD_LOGIN');
  await rejects(t.auth.loginWithUsername('no_such_user', 'anything'), 'BAD_LOGIN');
});

test('the code goes to the email address; an email already in use is refused without sending anything', async () => {
  const t = setup();
  await startSignup(t, { email: 'Akash@Example.com' });
  assert.equal(t.mail.filter((m) => m.kind === 'otp').length, 1);
  assert.equal(t.mail.at(-1).to, 'Akash@Example.com');

  const other = setup();
  other.users.set('usr_x', { id: 'usr_x', email: 'taken@example.com', username: null, name: 'x', passwordHash: '', salt: '', verified: true, refreshToken: null, subscription: null });
  const { registrationId } = await other.signup.register('new_user', 'correct horse 1');
  await rejects(other.signup.requestCode(registrationId, 'TAKEN@example.com'), 'EMAIL_UNAVAILABLE');
  assert.equal(other.mail.length, 0, 'no code is sent to an address that already has an account');
});

test('a bad email address is refused', async () => {
  const t = setup();
  const { registrationId } = await t.signup.register('akash_42', 'correct horse 1');
  await rejects(t.signup.requestCode(registrationId, 'not-an-email'), 'INVALID_EMAIL');
});

test('a resend within 60 seconds is refused; after that a new code is sent', async () => {
  const t = setup();
  const id = await startSignup(t);
  await rejects(t.signup.requestCode(id, 'akash@example.com'), 'RESEND_COOLDOWN');
  t.advance(CODE_RESEND_COOLDOWN_MS);
  const first = t.lastCode();
  await t.signup.requestCode(id, 'akash@example.com');
  assert.equal(t.mail.filter((m) => m.kind === 'otp').length, 2);
  await rejects(t.signup.verifyCode(id, first), 'BAD_CODE'); // the old code no longer works
  await t.signup.verifyCode(id, t.lastCode());
  assert.equal(t.users.size, 1);
});

test('a failed code email is reported, and the user can retry at once (no cooldown was started)', async () => {
  const t = setup();
  const { registrationId } = await t.signup.register('akash_42', 'correct horse 1');
  t.fail.otp = true;
  await rejects(t.signup.requestCode(registrationId, 'akash@example.com'), 'EMAIL_DELIVERY_FAILED');
  t.fail.otp = false;
  await t.signup.requestCode(registrationId, 'akash@example.com');
  assert.equal(t.mail.filter((m) => m.kind === 'otp').length, 1);
});

test('a wrong code is refused; after the limit the code is thrown away even if the right one comes next', async () => {
  const t = setup();
  const id = await startSignup(t);
  const right = t.lastCode();
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    await rejects(t.signup.verifyCode(id, '000000'), 'BAD_CODE');
  }
  await rejects(t.signup.verifyCode(id, right), 'CODE_LOCKED');
  await rejects(t.signup.verifyCode(id, right), 'NO_CODE');
  assert.equal(t.users.size, 0);
});

test('an expired code is refused', async () => {
  const t = setup();
  const id = await startSignup(t);
  const code = t.lastCode();
  t.advance(OTP_TTL_MS + 1);
  await rejects(t.signup.verifyCode(id, code), 'CODE_EXPIRED');
  assert.equal(t.users.size, 0);
});

test('verifying creates the account, emails the username and password, and then the sign-up is gone', async () => {
  const t = setup();
  const id = await startSignup(t);
  const result = await t.signup.verifyCode(id, t.lastCode());
  assert.equal(result.verified, true);
  assert.equal(result.credentialsSent, true);

  const user = [...t.users.values()][0];
  assert.equal(user.username, 'akash_42');
  assert.equal(user.verified, true);
  assert.equal(user.email, 'akash@example.com');
  assert.ok(!JSON.stringify(user).includes('correct horse 1'), 'the account stores only the hash');

  const credentials = t.mail.find((m) => m.kind === 'credentials');
  assert.equal(credentials.to, 'akash@example.com');
  assert.equal(credentials.username, 'akash_42');
  assert.equal(credentials.password, 'correct horse 1');
  assert.equal(t.regs.has(id), false, 'the encrypted copy of the password is erased once it is emailed');

  await rejects(t.signup.verifyCode(id, t.lastCode()), 'REGISTRATION_NOT_FOUND');
});

test('a used code cannot be used again', async () => {
  const t = setup();
  const id = await startSignup(t);
  const code = t.lastCode();
  await t.signup.verifyCode(id, code);
  await rejects(t.signup.verifyCode(id, code), 'REGISTRATION_NOT_FOUND');
});

test('after verifying, the username and password log in; a wrong password does not', async () => {
  const t = setup();
  const id = await startSignup(t);
  await t.signup.verifyCode(id, t.lastCode());

  const session = await t.auth.loginWithUsername('AKASH_42', 'correct horse 1');
  assert.equal(session.user.email, 'akash@example.com');
  assert.ok(session.token && session.refreshToken);
  await rejects(t.auth.loginWithUsername('akash_42', 'wrong password'), 'BAD_LOGIN');
});

test('repeated wrong passwords lock the username for a while', async () => {
  const t = setup();
  const id = await startSignup(t);
  await t.signup.verifyCode(id, t.lastCode());
  for (let i = 0; i < MAX_LOGIN_FAILURES; i++) {
    await rejects(t.auth.loginWithUsername('akash_42', 'wrong password'), 'BAD_LOGIN');
  }
  await rejects(t.auth.loginWithUsername('akash_42', 'correct horse 1'), 'LOGIN_LOCKED');
});

test('a failed credentials email is reported, and it can be resent while the password copy is held', async () => {
  const t = setup();
  const id = await startSignup(t);
  t.fail.credentials = true;
  const result = await t.signup.verifyCode(id, t.lastCode());
  assert.equal(result.verified, true, 'the account is still created');
  assert.equal(result.credentialsSent, false);
  assert.match(result.credentialsError, /could not email/);
  await rejects(t.signup.resendCredentials(id), 'CREDENTIALS_EMAIL_FAILED');

  t.fail.credentials = false;
  assert.deepEqual(await t.signup.resendCredentials(id), { sent: true });
  const credentials = t.mail.filter((m) => m.kind === 'credentials');
  assert.equal(credentials.length, 1);
  assert.equal(credentials[0].password, 'correct horse 1');
  await rejects(t.signup.resendCredentials(id), 'REGISTRATION_NOT_FOUND');
});

test('a sign-up that is never verified expires: no account, and the username is free again', async () => {
  const t = setup();
  const id = await startSignup(t, { username: 'slow_user' });
  t.advance(REGISTRATION_TTL_MS + 1);
  await rejects(t.signup.verifyCode(id, '123456'), 'REGISTRATION_NOT_FOUND');
  assert.equal(t.users.size, 0);
  await t.signup.register('slow_user', 'correct horse 1');
  await rejects(t.auth.loginWithUsername('slow_user', 'correct horse 1'), 'BAD_LOGIN');
});

test('if the email was taken after the code was sent, verification refuses and creates nothing', async () => {
  const t = setup();
  const id = await startSignup(t);
  const code = t.lastCode();
  t.users.set('usr_other', { id: 'usr_other', email: 'akash@example.com', username: null, name: 'x', passwordHash: '', salt: '', verified: true, refreshToken: null, subscription: null });
  await rejects(t.signup.verifyCode(id, code), 'EMAIL_UNAVAILABLE');
  assert.equal(t.users.size, 1);
});

test('no encryption key configured: sign-up is refused with 503 and nothing is stored', async () => {
  const t = setup();
  const refusing = createSignupFlow({
    store: t.store,
    mailer: { sendOtp: async () => {}, sendCredentials: async () => {} },
    hashPassword,
    seal: () => { throw new AuthError(503, 'Username sign-up is not available right now.', 'NOT_CONFIGURED'); },
    open: () => { throw new Error('unreachable'); },
  });
  await assert.rejects(refusing.register('akash_42', 'correct horse 1'), (e) => e.status === 503);
});

test('the sealed password cannot be altered without detection', () => {
  const sealed = sealWith('correct horse 1', KEY);
  const bytes = Buffer.from(sealed, 'base64');
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => openWith(bytes.toString('base64'), KEY));
  assert.notEqual(sealWith('same', KEY), sealWith('same', KEY), 'each seal uses a fresh nonce');
});
