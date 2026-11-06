import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubscriptionState,
  createDefaultTrialSubscription,
  isValidEmail,
} from '../lib/auth.ts';
import {
  CASHFREE_PAYMENT_METHODS,
  normalizeIndianMobile,
  startCheckout,
  verifyPayment,
  waitForPayment,
} from '../lib/cashfree.ts';

test('1st one-week (7-day) free trial period is initialized correctly', () => {
  const sub = createDefaultTrialSubscription();
  assert.equal(sub.status, 'trial');
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 7);

  const start = new Date(sub.trialStartDate).getTime();
  const end = new Date(sub.trialEndDate).getTime();
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 7, 'Trial period must be exactly 7 days');
});

test('Trial expiration is detected after 7 days', () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const sub = calculateSubscriptionState({}, eightDaysAgo);
  assert.equal(sub.isTrialActive, false);
  assert.equal(sub.trialDaysRemaining, 0);
  assert.equal(sub.status, 'expired');
});

test('Auto-renewal notice date is scheduled 15 days before the 1-year mark', () => {
  const now = new Date();
  const sub = calculateSubscriptionState();
  const periodEnd = new Date(sub.currentPeriodEnd).getTime();
  const renewalNotice = new Date(sub.renewalNoticeDate).getTime();
  
  const diffNoticeDays = Math.round((periodEnd - renewalNotice) / (1000 * 60 * 60 * 24));
  assert.equal(diffNoticeDays, 15, 'Auto-renewal notice must be exactly 15 days before 1 year completion');
  assert.equal(sub.autoRenewal, true, 'Auto-renewal is enabled by default');
});

test('Email validation correctly identifies valid and invalid addresses for Mail Login', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('dr.sophia@clinic.org'), true);
  assert.equal(isValidEmail('alex+travel@domain.co.in'), true);

  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('invalid-email'), false);
  assert.equal(isValidEmail('missing@domain'), false);
  assert.equal(isValidEmail('@nodomain.com'), false);
});

test('checkout asks the server for an order and never sends a price or user id', async () => {
  const calls = [];
  const fakeFetch = async (path, options) => { calls.push({ path, body: JSON.parse(options.body) }); return { orderId: 'SC_1', checkoutUrl: 'https://api/checkout/SC_1' }; };
  const session = await startCheckout(fakeFetch, '9876543210');
  assert.equal(session.orderId, 'SC_1');
  assert.equal(calls[0].path, '/cashfree/orders');
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['phone', 'plan']);
});

test('payment status comes from the server; pending is re-checked, final states stop', async () => {
  let n = 0;
  const outcome = await waitForPayment(async () => (++n < 3 ? 'pending' : 'paid'), { sleep: async () => {} });
  assert.equal(outcome, 'paid');
  assert.equal(n, 3);
  n = 0;
  assert.equal(await waitForPayment(async () => { n++; return 'failed'; }, { sleep: async () => {} }), 'failed');
  assert.equal(n, 1);
  assert.equal(await waitForPayment(async () => 'pending', { attempts: 2, sleep: async () => {} }), 'pending');
  const seen = [];
  assert.equal(await verifyPayment(async (path) => { seen.push(path); return { status: 'cancelled' }; }, 'SC 1'), 'cancelled');
  assert.equal(seen[0], '/cashfree/orders/SC%201/verify');
});

test('mobile numbers for Cashfree are validated before any request', () => {
  assert.equal(normalizeIndianMobile('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianMobile('098765 43210'), '9876543210');
  assert.equal(normalizeIndianMobile('12345'), null);
  assert.equal(normalizeIndianMobile('5876543210'), null);
});

test('Cashfree payment channels (UPI, Card, NetBanking) are configured', () => {
  assert.equal(CASHFREE_PAYMENT_METHODS.length, 3);
  const ids = CASHFREE_PAYMENT_METHODS.map(m => m.id);
  assert.ok(ids.includes('upi'));
  assert.ok(ids.includes('card'));
  assert.ok(ids.includes('netbanking'));
});

test('Annual subscription activation updates status to annual with Cashfree payment reference', () => {
  const sub = calculateSubscriptionState({
    status: 'annual',
    cashfreePaymentId: 'cf_pay_12345',
    cashfreeOrderId: 'CF_ORDER_12345',
    cashfreePaymentMethod: 'UPI (GPay)',
  });

  assert.equal(sub.status, 'annual');
  assert.equal(sub.cashfreePaymentId, 'cf_pay_12345');
  assert.equal(sub.cashfreeOrderId, 'CF_ORDER_12345');
  assert.equal(sub.autoRenewal, true);
});

