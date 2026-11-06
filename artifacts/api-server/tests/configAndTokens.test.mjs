import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokenSecret, resolveCashfreeConfig, assertServerConfig } from '../src/lib/config.ts';
import { createToken, verifyToken } from '../src/lib/auth.ts';

const SECRET = 'x'.repeat(48);

test('production refuses to start without a strong TOKEN_SECRET', () => {
  assert.throws(() => resolveTokenSecret({ NODE_ENV: 'production' }), /TOKEN_SECRET is not set/);
  assert.throws(() => resolveTokenSecret({ NODE_ENV: 'production', TOKEN_SECRET: 'short' }), /too short/);
  assert.throws(() => assertServerConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' }), /TOKEN_SECRET/);
  assert.equal(resolveTokenSecret({ NODE_ENV: 'production', TOKEN_SECRET: SECRET }).secret, SECRET);
});

test('development without TOKEN_SECRET uses a random secret, never a known string', () => {
  const a = resolveTokenSecret({ NODE_ENV: 'development' });
  const b = resolveTokenSecret({ NODE_ENV: 'development' });
  assert.equal(a.generated, true);
  assert.notEqual(a.secret, b.secret);
  assert.ok(a.secret.length >= 32);
});

test('Cashfree config requires id, secret and an explicit environment', () => {
  assert.equal(resolveCashfreeConfig({}), null);
  assert.equal(resolveCashfreeConfig({ CASHFREE_APP_ID: 'a', CASHFREE_SECRET_KEY: '' , CASHFREE_ENV: 'SANDBOX' }), null);
  assert.equal(resolveCashfreeConfig({ CASHFREE_APP_ID: 'a', CASHFREE_SECRET_KEY: 's' }), null);
  assert.equal(resolveCashfreeConfig({ CASHFREE_APP_ID: 'a', CASHFREE_SECRET_KEY: 's', CASHFREE_ENV: 'PRODUCTION' }).apiBase, 'https://api.cashfree.com/pg');
});

test('tokens: valid ones verify; forged, expired, foreign and malformed ones do not', async () => {
  const token = createToken({ userId: 'u1', type: 'access' }, 60_000, SECRET);
  assert.equal(verifyToken(token, SECRET).userId, 'u1');
  assert.equal(verifyToken(token, 'y'.repeat(48)), null, 'signed with another secret');
  const [body] = token.split('.');
  const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), userId: 'admin' })).toString('base64url');
  assert.equal(verifyToken(`${tampered}.${token.split('.')[1]}`, SECRET), null, 'payload changed');
  assert.equal(verifyToken(`${body}.short`, SECRET), null, 'wrong-length signature must not throw');
  assert.equal(verifyToken('garbage', SECRET), null);
  assert.equal(verifyToken(createToken({ userId: 'u1' }, -1, SECRET), SECRET), null, 'expired');
  // A correctly signed token without our issuer/audience (e.g. from an older build) is refused.
  const crypto = await import('node:crypto');
  const legacyBody = Buffer.from(JSON.stringify({ userId: 'u1', exp: Date.now() + 60_000 })).toString('base64url');
  const legacySig = crypto.createHmac('sha256', SECRET).update(legacyBody).digest('base64url');
  assert.equal(verifyToken(`${legacyBody}.${legacySig}`, SECRET), null);
});
