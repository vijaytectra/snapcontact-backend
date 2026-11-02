import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubscriptionState,
  createDefaultTrialSubscription,
  isValidEmail,
} from '../lib/auth.ts';
import {
  createCashfreeOrder,
  processCashfreePayment,
  CASHFREE_PAYMENT_METHODS,
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

test('Cashfree order creation includes INR currency, customer details, and session ID', () => {
  const customer = {
    customerId: 'cust_test_123',
    customerEmail: 'test.user@example.com',
    customerName: 'Test User',
    customerPhone: '9876543210',
  };

  const order = createCashfreeOrder(customer, 999);
  assert.ok(order.orderId.startsWith('CF_ORDER_'));
  assert.equal(order.orderAmount, 999);
  assert.equal(order.orderCurrency, 'INR');
  assert.equal(order.status, 'ACTIVE');
  assert.ok(order.paymentSessionId.startsWith('session_'));
  assert.equal(order.customerDetails.customerEmail, 'test.user@example.com');
});

test('Cashfree payment channels (UPI, Card, NetBanking) are configured', () => {
  assert.equal(CASHFREE_PAYMENT_METHODS.length, 3);
  const ids = CASHFREE_PAYMENT_METHODS.map(m => m.id);
  assert.ok(ids.includes('upi'));
  assert.ok(ids.includes('card'));
  assert.ok(ids.includes('netbanking'));
});

test('Cashfree payment processing completes with transaction reference and success status', async () => {
  const order = createCashfreeOrder({
    customerId: 'cust_upi_1',
    customerEmail: 'alex@example.com',
  }, 999);

  const result = await processCashfreePayment(order, 'UPI', 'Google Pay');
  assert.equal(result.success, true);
  assert.equal(result.orderId, order.orderId);
  assert.ok(result.paymentId.startsWith('cf_pay_'));
  assert.ok(result.referenceId.startsWith('cf_ref_'));
  assert.equal(result.paymentMethod, 'UPI');
  assert.equal(result.amount, 999);
  assert.equal(result.currency, 'INR');
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

