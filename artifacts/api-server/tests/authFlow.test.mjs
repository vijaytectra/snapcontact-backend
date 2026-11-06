// Run: node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthFlow, AuthError, OTP_TTL_MS, MAX_CODE_ATTEMPTS, MAX_LOGIN_FAILURES } from '../src/lib/authFlow.ts';
import { hashPassword, verifyPassword, createToken, verifyToken } from '../src/lib/auth.ts';

function setup() {
  const users = new Map();
  const verifications = new Map();
  const mail = [];
  let clock = Date.parse('2026-11-06T10:00:00Z');
  const lower = (e) => e.trim().toLowerCase();
  const store = {
    async findUserByEmail(e) { return [...users.values()].find((u) => lower(u.email) === lower(e)); },
    async findUserById(id) { return users.get(id); },
    async insertUser(u) { users.set(u.id, { ...u }); },
    async updateUser(id, patch) { users.set(id, { ...users.get(id), ...patch }); },
    async saveVerification(v) { verifications.set(lower(v.email), { ...v }); },
    async findVerification(e) { return verifications.get(lower(e)); },
    async deleteVerification(e) { verifications.delete(lower(e)); },
  };
  const flow = createAuthFlow({
    store, mailer: {
      async sendOtp(to, otp) { mail.push({ to, otp }); },
      async sendMagicLink(to, link) { mail.push({ to, link }); },
    },
    hashPassword, verifyPassword, createToken, verifyToken, now: () => clock,
  });
  return {
    flow, users, verifications, mail,
    lastCode: () => mail.filter((m) => m.otp).at(-1).otp,
    lastLinkToken: () => new URL(mail.filter((m) => m.link).at(-1).link).searchParams.get('token'),
    advance: (ms) => { clock += ms; },
  };
}

const rejects = (promise, code) => assert.rejects(promise, (e) => e instanceof AuthError && e.code === code);

test('first sign-in: email code, then password creation; the code is not asked again', async () => {
  const t = setup();
  assert.deepEqual(await t.flow.checkEmail('new@example.com'), { method: 'otp' });
  await t.flow.requestCode('new@example.com');
  const session = await t.flow.verifyCode('new@example.com', t.lastCode(), 'New User');
  assert.equal(session.needsPassword, true);
  assert.equal(session.user.name, 'New User');

  const after = await t.flow.setPassword(session.token, 'correct horse 1');
  assert.equal(after.needsPassword, false);
  const stored = [...t.users.values()][0];
  assert.ok(!JSON.stringify(stored).includes('correct horse 1'), 'password is stored hashed, never as text');

  // Next time: straight to the password screen, no email sent.
  const sent = t.mail.length;
  assert.deepEqual(await t.flow.checkEmail('NEW@example.com'), { method: 'password' });
  const login = await t.flow.loginWithPassword('new@example.com', 'correct horse 1');
  assert.equal(login.user.email, 'new@example.com');
  assert.equal(t.mail.length, sent);
});

test('password login rejects wrong and empty passwords with the same message as unknown emails', async () => {
  const t = setup();
  await t.flow.requestCode('a@example.com');
  const s = await t.flow.verifyCode('a@example.com', t.lastCode());
  // Accounts made by code start with no password: an empty password must never sign in.
  await rejects(t.flow.loginWithPassword('a@example.com', ''), 'BAD_LOGIN');
  await t.flow.setPassword(s.token, 'password123');
  const wrong = await t.flow.loginWithPassword('a@example.com', 'nope-nope').catch((e) => e);
  const unknown = await t.flow.loginWithPassword('ghost@example.com', 'nope-nope').catch((e) => e);
  assert.equal(wrong.message, unknown.message);
  assert.equal(wrong.status, unknown.status);
});

test('repeated wrong passwords lock the account for a while, then it works again', async () => {
  const t = setup();
  await t.flow.requestCode('b@example.com');
  const s = await t.flow.verifyCode('b@example.com', t.lastCode());
  await t.flow.setPassword(s.token, 'password123');
  for (let i = 0; i < MAX_LOGIN_FAILURES; i++) await rejects(t.flow.loginWithPassword('b@example.com', 'wrong-pass'), 'BAD_LOGIN');
  await rejects(t.flow.loginWithPassword('b@example.com', 'password123'), 'LOGIN_LOCKED');
  t.advance(16 * 60 * 1000);
  assert.ok(await t.flow.loginWithPassword('b@example.com', 'password123'));
});

test('forgot password: code by email, new password works, old one does not', async () => {
  const t = setup();
  await t.flow.requestCode('c@example.com');
  const first = await t.flow.verifyCode('c@example.com', t.lastCode());
  await t.flow.setPassword(first.token, 'old-password');

  assert.deepEqual(await t.flow.forgotPassword('c@example.com'), { sent: true });
  assert.equal(t.mail.at(-1).to, 'c@example.com');
  const reset = await t.flow.verifyCode('c@example.com', t.lastCode());
  await t.flow.setPassword(reset.token, 'new-password');

  await rejects(t.flow.loginWithPassword('c@example.com', 'old-password'), 'BAD_LOGIN');
  assert.ok(await t.flow.loginWithPassword('c@example.com', 'new-password'));
});

test('forgot password does not reveal unregistered emails and sends them nothing', async () => {
  const t = setup();
  assert.deepEqual(await t.flow.forgotPassword('nobody@example.com'), { sent: true });
  assert.equal(t.mail.length, 0);
  await rejects(t.flow.verifyCode('nobody@example.com', '123456'), 'BAD_CODE');
});

test('a password session cannot change the password; only a fresh code can', async () => {
  const t = setup();
  await t.flow.requestCode('d@example.com');
  const s = await t.flow.verifyCode('d@example.com', t.lastCode());
  await t.flow.setPassword(s.token, 'password123');
  const login = await t.flow.loginWithPassword('d@example.com', 'password123');
  await rejects(t.flow.setPassword(login.token, 'hijacked-pass'), 'REVERIFY');
  await rejects(t.flow.setPassword(s.token, 'short'), 'WEAK_PASSWORD');
});

test('expired codes are rejected and removed', async () => {
  const t = setup();
  await t.flow.requestCode('e@example.com');
  const code = t.lastCode();
  t.advance(OTP_TTL_MS + 1000);
  await rejects(t.flow.verifyCode('e@example.com', code), 'BAD_CODE');
  assert.equal(t.verifications.size, 0);
});

test('codes are single use', async () => {
  const t = setup();
  await t.flow.requestCode('f@example.com');
  const code = t.lastCode();
  await t.flow.verifyCode('f@example.com', code);
  await rejects(t.flow.verifyCode('f@example.com', code), 'BAD_CODE');
});

test('a new code replaces the old one', async () => {
  const t = setup();
  await t.flow.requestCode('g@example.com');
  const old = t.lastCode();
  await t.flow.requestCode('g@example.com');
  if (old !== t.lastCode()) await rejects(t.flow.verifyCode('g@example.com', old), 'BAD_CODE');
  assert.ok(await t.flow.verifyCode('g@example.com', t.lastCode()));
});

test('too many wrong codes throw the code away, even if the right one comes next', async () => {
  const t = setup();
  await t.flow.requestCode('h@example.com');
  const code = t.lastCode();
  const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) await rejects(t.flow.verifyCode('h@example.com', wrong), 'BAD_CODE');
  await rejects(t.flow.verifyCode('h@example.com', wrong), 'CODE_LOCKED');
  await rejects(t.flow.verifyCode('h@example.com', code), 'BAD_CODE');
});

test('check-email answers "otp" for both unknown emails and accounts without a password', async () => {
  const t = setup();
  await t.flow.requestCode('i@example.com');
  await t.flow.verifyCode('i@example.com', t.lastCode());
  assert.deepEqual(await t.flow.checkEmail('i@example.com'), { method: 'otp' });
  assert.deepEqual(await t.flow.checkEmail('unknown@example.com'), { method: 'otp' });
});

test('magic link, first sign-in: the password step is still required', async () => {
  const t = setup();
  await t.flow.requestCode('link@example.com');
  const session = await t.flow.verifyLink('link@example.com', t.lastLinkToken());
  assert.equal(session.needsPassword, true);
  await t.flow.setPassword(session.token, 'link-pass-1');
  assert.deepEqual(await t.flow.checkEmail('link@example.com'), { method: 'password' });
});

test('magic link, existing user with a password: signs in without asking again', async () => {
  const t = setup();
  await t.flow.requestCode('old@example.com');
  const s = await t.flow.verifyCode('old@example.com', t.lastCode());
  await t.flow.setPassword(s.token, 'old-pass-1');
  await t.flow.requestCode('old@example.com');
  const session = await t.flow.verifyLink('old@example.com', t.lastLinkToken());
  assert.equal(session.needsPassword, false);
});

test('magic links are single use and expire', async () => {
  const t = setup();
  await t.flow.requestCode('ml@example.com');
  const token = t.lastLinkToken();
  await t.flow.verifyLink('ml@example.com', token);
  await rejects(t.flow.verifyLink('ml@example.com', token), 'BAD_LINK');
  await t.flow.requestCode('ml@example.com');
  const second = t.lastLinkToken();
  t.advance(OTP_TTL_MS + 1000);
  await rejects(t.flow.verifyLink('ml@example.com', second), 'BAD_LINK');
  await rejects(t.flow.verifyLink('ml@example.com', 'not-a-token'), 'BAD_LINK');
});

test('the subscription sent to the app is the server-described one', async () => {
  const t = setup();
  const flow = createAuthFlow({
    store: { findUserByEmail: async () => undefined, findUserById: async () => undefined, insertUser: async () => {}, updateUser: async () => {},
      saveVerification: async () => {}, findVerification: async () => undefined, deleteVerification: async () => {} },
    mailer: { async sendOtp() {} }, hashPassword, verifyPassword, createToken, verifyToken,
    describeSubscription: () => ({ status: 'annual' }),
  });
  assert.deepEqual(flow.publicUser({ id: 'u', email: 'e', name: 'n', subscription: { status: 'trial' } }).subscription, { status: 'annual' });
  assert.ok(t);
});
