// Run: node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPayments, cashfreeSignature, PaymentError } from '../src/lib/payments.ts';
import { activatePlan, describeSubscription, getPlan, newTrial, PLANS } from '../src/lib/subscription.ts';

const CONFIG = { appId: 'app', secretKey: 'test-secret', env: 'SANDBOX', apiBase: 'https://sandbox.cashfree.com/pg' };
const NOW = Date.parse('2026-11-06T10:00:00Z');
const URLS = { returnUrl: 'https://api.test/api/cashfree/return?order_id={order_id}', notifyUrl: 'https://api.test/api/webhooks/cashfree' };

/** In-memory store plus a fake Cashfree that records what it was asked and answers as told. */
function setup({ config = CONFIG } = {}) {
  const users = new Map([
    ['u1', { id: 'u1', email: 'one@example.com', name: 'One', createdAt: new Date(NOW).toISOString(), subscription: newTrial(NOW) }],
    ['u2', { id: 'u2', email: 'two@example.com', name: 'Two', createdAt: new Date(NOW).toISOString(), subscription: newTrial(NOW) }],
  ]);
  const orders = new Map();
  const events = new Set();
  let activations = 0;
  const remote = { orders: new Map(), payments: new Map(), created: [] };
  const store = {
    async findUserById(id) { return users.get(id); },
    async findOrderById(id) { return orders.get(id); },
    async findOpenOrder(userId, plan) { return [...orders.values()].reverse().find((o) => o.userId === userId && o.plan === plan && o.status === 'ACTIVE'); },
    async insertOrder(o) { orders.set(o.orderId, { ...o }); },
    async setOrderStatus(id, status) { const o = orders.get(id); if (o.status !== 'PAID') o.status = status; },
    async activatePaidOrder(id, paymentId, plan, now) {
      const o = orders.get(id);
      if (o.status === 'PAID') return false;
      o.status = 'PAID'; o.cashfreePaymentId = paymentId;
      const u = users.get(o.userId);
      u.subscription = activatePlan(u.subscription, plan, id, paymentId, now);
      activations++;
      return true;
    },
    async recordEvent(key) { if (events.has(key)) return false; events.add(key); return true; },
    async hasActivePlan(userId, now) { const u = users.get(userId); return describeSubscription(u.subscription, u.createdAt, now).status === 'annual'; },
  };
  const cashfree = {
    async createOrder(body) {
      remote.created.push(body);
      const o = { order_id: body.order_id, order_amount: body.order_amount, order_currency: body.order_currency, order_status: 'ACTIVE', payment_session_id: `session_${body.order_id}`, customer_details: { customer_id: body.customer_details.customer_id } };
      remote.orders.set(body.order_id, o);
      remote.payments.set(body.order_id, []);
      return o;
    },
    async getOrder(id) { return remote.orders.get(id); },
    async getPayments(id) { return remote.payments.get(id) ?? []; },
  };
  const payments = createPayments({ store, cashfree: config ? cashfree : null, config, now: () => NOW });
  /** Simulates what Cashfree reports after a real checkout. */
  const pay = (orderId, { status = 'SUCCESS', amount, currency = 'INR', orderStatus } = {}) => {
    const o = remote.orders.get(orderId);
    remote.payments.get(orderId).push({ cf_payment_id: 5000 + remote.payments.get(orderId).length, payment_status: status, payment_amount: amount ?? o.order_amount, payment_currency: currency });
    o.order_status = orderStatus ?? (status === 'SUCCESS' ? 'PAID' : 'ACTIVE');
  };
  const webhook = (order, { type = 'PAYMENT_SUCCESS_WEBHOOK', amount = order.amount, currency = 'INR', paymentStatus = 'SUCCESS', customerId = order.userId, paymentId = 5000 } = {}) => {
    const raw = JSON.stringify({
      type,
      data: {
        order: { order_id: order.orderId, order_amount: amount, order_currency: currency },
        payment: { cf_payment_id: paymentId, payment_status: paymentStatus, payment_amount: amount, payment_currency: currency },
        customer_details: { customer_id: customerId },
      },
    });
    const ts = String(NOW);
    return { raw, ts, sig: cashfreeSignature(ts, raw, CONFIG.secretKey) };
  };
  return { payments, users, orders, remote, pay, webhook, get activations() { return activations; } };
}

const rejects = (p, code) => assert.rejects(p, (e) => e instanceof PaymentError && e.code === code);
const subOf = (t, id) => describeSubscription(t.users.get(id).subscription, t.users.get(id).createdAt, NOW);

test('missing Cashfree credentials fail closed with a configuration error', async () => {
  const t = setup({ config: null });
  await rejects(t.payments.createOrder('u1', 'annual', '9876543210', URLS), 'PAYMENTS_NOT_CONFIGURED');
  await rejects(t.payments.verifyOrder('u1', 'x'), 'PAYMENTS_NOT_CONFIGURED');
  const hook = await t.payments.handleWebhook('{}', 'sig', '1');
  assert.equal(hook.status, 503);
});

test('order price and owner come from the server, not the request', async () => {
  const t = setup();
  const order = await t.payments.createOrder('u1', 'annual', '+91 98765 43210', URLS);
  assert.equal(order.amount, PLANS.annual.amount);
  const sent = t.remote.created[0];
  assert.equal(sent.order_amount, 99);
  assert.equal(sent.order_currency, 'INR');
  assert.equal(sent.customer_details.customer_id, 'u1');
  assert.equal(sent.customer_details.customer_email, 'one@example.com');
  assert.match(sent.order_meta.return_url, new RegExp(order.orderId));
  assert.equal(t.orders.get(order.orderId).amount, 99, 'order stored before checkout details are returned');
  await rejects(t.payments.createOrder('u1', 'lifetime', '9876543210', URLS), 'INVALID_PLAN');
  await rejects(t.payments.createOrder('u1', 'annual', '12345', URLS), 'INVALID_PHONE');
});

test('an open order is reused instead of creating duplicates', async () => {
  const t = setup();
  const a = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  const b = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  assert.equal(a.orderId, b.orderId);
  assert.equal(t.remote.created.length, 1);
});

test('successful payment verified with Cashfree activates the plan exactly once', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  assert.equal(subOf(t, 'u1').status, 'trial');
  t.pay(orderId);
  assert.equal(await t.payments.verifyOrder('u1', orderId), 'paid');
  assert.equal(subOf(t, 'u1').status, 'annual');
  assert.equal(await t.payments.verifyOrder('u1', orderId), 'paid');
  assert.equal(t.activations, 1);
  await rejects(t.payments.createOrder('u1', 'annual', '9876543210', URLS), 'ALREADY_ACTIVE');
});

test('pending, failed and cancelled payments never activate the plan', async () => {
  for (const [status, expected] of [[null, 'pending'], ['FAILED', 'failed'], ['USER_DROPPED', 'cancelled']]) {
    const t = setup();
    const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
    if (status) t.pay(orderId, { status });
    assert.equal(await t.payments.verifyOrder('u1', orderId), expected);
    assert.equal(subOf(t, 'u1').status, 'trial');
  }
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.remote.orders.get(orderId).order_status = 'EXPIRED';
  assert.equal(await t.payments.verifyOrder('u1', orderId), 'failed');
  assert.equal(t.orders.get(orderId).status, 'EXPIRED');
});

test('a paid order whose amount or currency differs from ours is rejected', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId, { amount: 1 });
  await rejects(t.payments.verifyOrder('u1', orderId), 'NO_MATCHING_PAYMENT');
  const t2 = setup();
  const second = await t2.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t2.pay(second.orderId, { currency: 'USD' });
  await rejects(t2.payments.verifyOrder('u1', second.orderId), 'NO_MATCHING_PAYMENT');
  assert.equal(subOf(t, 'u1').status, 'trial');
});

test("one user cannot check or activate another user's order", async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId);
  await rejects(t.payments.verifyOrder('u2', orderId), 'ORDER_NOT_FOUND');
  assert.equal(subOf(t, 'u2').status, 'trial');
  await rejects(t.payments.verifyOrder('u1', 'SC_unknown'), 'ORDER_NOT_FOUND');
});

test('webhook: valid signature and verified payment activate once; duplicates are ignored', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId);
  const hook = t.webhook(t.orders.get(orderId));
  const first = await t.payments.handleWebhook(hook.raw, hook.sig, hook.ts);
  assert.equal(first.status, 200);
  assert.equal(first.body.outcome, 'paid');
  const again = await t.payments.handleWebhook(hook.raw, hook.sig, hook.ts);
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal(t.activations, 1);
  assert.equal(subOf(t, 'u1').status, 'annual');
});

test('webhook: bad or missing signatures and empty secrets are rejected', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId);
  const hook = t.webhook(t.orders.get(orderId));
  assert.equal((await t.payments.handleWebhook(hook.raw, 'forged', hook.ts)).status, 401);
  const emptyKeySig = cashfreeSignature(hook.ts, hook.raw, '');
  assert.equal((await t.payments.handleWebhook(hook.raw, emptyKeySig, hook.ts)).status, 401);
  assert.equal((await t.payments.handleWebhook(hook.raw + ' ', hook.sig, hook.ts)).status, 401, 'body must be byte-identical');
  assert.equal((await t.payments.handleWebhook(hook.raw, hook.sig, undefined)).status, 400);
  assert.equal((await t.payments.handleWebhook(undefined, hook.sig, hook.ts)).status, 400);
  assert.equal(subOf(t, 'u1').status, 'trial');
});

test('webhook: wrong amount, currency, owner or unknown order are rejected', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId);
  const order = t.orders.get(orderId);
  for (const bad of [{ amount: 1 }, { currency: 'USD' }, { customerId: 'u2' }]) {
    const hook = t.webhook(order, bad);
    assert.equal((await t.payments.handleWebhook(hook.raw, hook.sig, hook.ts)).status, 400, JSON.stringify(bad));
  }
  const unknown = t.webhook({ ...order, orderId: 'SC_nope' });
  assert.equal((await t.payments.handleWebhook(unknown.raw, unknown.sig, unknown.ts)).status, 404);
  assert.equal(subOf(t, 'u1').status, 'trial');
});

test('webhook: a signed success the gateway does not confirm does not activate', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  // No payment at Cashfree: order still ACTIVE there.
  const hook = t.webhook(t.orders.get(orderId));
  const res = await t.payments.handleWebhook(hook.raw, hook.sig, hook.ts);
  assert.equal(res.body.outcome, 'pending');
  assert.equal(subOf(t, 'u1').status, 'trial');
});

test('webhook: failed payment does not activate', async () => {
  const t = setup();
  const { orderId } = await t.payments.createOrder('u1', 'annual', '9876543210', URLS);
  t.pay(orderId, { status: 'FAILED' });
  const hook = t.webhook(t.orders.get(orderId), { type: 'PAYMENT_FAILED_WEBHOOK', paymentStatus: 'FAILED' });
  const res = await t.payments.handleWebhook(hook.raw, hook.sig, hook.ts);
  assert.equal(res.body.outcome, 'failed');
  assert.equal(subOf(t, 'u1').status, 'trial');
});

test('subscription rules: trial expiry, paid period, persistence across devices', () => {
  const start = NOW;
  const trial = newTrial(start);
  assert.equal(describeSubscription(trial, new Date(start).toISOString(), start + 3 * 864e5).status, 'trial');
  assert.equal(describeSubscription(trial, new Date(start).toISOString(), start + 8 * 864e5).status, 'expired');
  // Legacy accounts without stored dates get a trial from sign-up.
  assert.equal(describeSubscription(null, new Date(start).toISOString(), start + 8 * 864e5).status, 'expired');
  const paid = activatePlan(trial, getPlan('annual'), 'o1', 'p1', start + 8 * 864e5);
  assert.equal(describeSubscription(paid, new Date(start).toISOString(), start + 100 * 864e5).status, 'annual');
  assert.equal(describeSubscription(paid, new Date(start).toISOString(), start + 400 * 864e5).status, 'expired');
  // The view is computed only from what the server stored, so any device sees the same thing.
  const json = JSON.parse(JSON.stringify(paid));
  assert.deepEqual(describeSubscription(json, '', start + 100 * 864e5), describeSubscription(paid, '', start + 100 * 864e5));
  assert.equal(getPlan('__proto__'), null);
});
