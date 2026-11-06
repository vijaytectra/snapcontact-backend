import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, ApiError } from '../lib/api.ts';

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

test('a dropped connection is retried and the request still succeeds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls < 3) throw new TypeError('Network request failed');
    return ok({ method: 'otp' });
  });
  const pending = apiFetch('/auth/check-email', { method: 'POST', body: '{}', retry: true });
  for (let i = 0; i < 5; i++) { await new Promise(setImmediate); t.mock.timers.tick(3000); }
  assert.deepEqual(await pending, { method: 'otp' });
  assert.equal(calls, 3);
});

test('a POST is not retried after a dropped connection, so it cannot run twice', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('Network request failed'); });
  const pending = apiFetch('/auth/request-otp', { method: 'POST', body: '{}' }).catch((e) => e);
  for (let i = 0; i < 5; i++) { await new Promise(setImmediate); t.mock.timers.tick(3000); }
  assert.ok((await pending) instanceof ApiError);
  assert.equal(calls, 1);
});

test('a success response with a non-JSON body is an error, not an empty answer', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Sign in to Wi-Fi</html>', { status: 200 }));
  await assert.rejects(apiFetch('/auth/me'), (e) => e instanceof ApiError && /unexpected response/.test(e.message));
});

test('a connection that stays down fails with a clear message after the retries', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('Network request failed'); });
  const pending = apiFetch('/auth/check-email').catch((e) => e);
  for (let i = 0; i < 5; i++) { await new Promise(setImmediate); t.mock.timers.tick(3000); }
  const err = await pending;
  assert.ok(err instanceof ApiError);
  assert.match(err.message, /Could not reach the server/);
  assert.equal(calls, 3);
});

test('server errors are not retried', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{"error":"Incorrect email or password."}', { status: 401 }); });
  await assert.rejects(apiFetch('/auth/login'), (e) => e.status === 401 && /Incorrect/.test(e.message));
  assert.equal(calls, 1);
});
