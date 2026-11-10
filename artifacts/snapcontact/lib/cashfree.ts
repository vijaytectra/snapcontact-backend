/**
 * Cashfree payments, client side. The app never prices, creates or confirms a payment itself:
 *   startCheckout  -> the server creates the order (price from its own plan table) and returns a
 *                     hosted checkout URL that runs Cashfree's official JS checkout.
 *   verifyPayment  -> after checkout, the server checks the order with Cashfree and, only if it is
 *                     paid in full, activates the plan in its database.
 * Card, UPI and bank details are entered on Cashfree's page, never in this app.
 */

export type PaymentOutcome = 'paid' | 'pending' | 'failed' | 'cancelled';

export type CheckoutSession = {
  orderId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  environment: 'SANDBOX' | 'PRODUCTION';
};

/** Payment methods Cashfree's checkout offers; shown for information only. */
export type CashfreePaymentMethodOption = {
  id: 'upi' | 'card' | 'netbanking';
  title: string;
  subtitle: string;
  icon: string;
};

export const CASHFREE_PAYMENT_METHODS: CashfreePaymentMethodOption[] = [
  { id: 'upi', title: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm, any UPI app', icon: 'flash-outline' },
  { id: 'card', title: 'Credit / Debit Card', subtitle: 'Visa, Mastercard, RuPay', icon: 'card-outline' },
  { id: 'netbanking', title: 'Net Banking', subtitle: 'Major Indian banks', icon: 'business-outline' },
];

/** Accepts "98765 43210", "+91 98765 43210" etc.; returns 10 digits or null. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

type AuthedFetch = (path: string, options?: RequestInit & { timeoutMs?: number }) => Promise<any>;

// Creating an order is one quick call. If the server has not answered in this time, stop
// waiting and show the error with the form, instead of spinning for a minute.
const ORDER_TIMEOUT_MS = 20_000;

export async function startCheckout(authedFetch: AuthedFetch, phone: string, plan = 'annual'): Promise<CheckoutSession> {
  return authedFetch('/cashfree/orders', { method: 'POST', body: JSON.stringify({ plan, phone }), timeoutMs: ORDER_TIMEOUT_MS });
}

export async function verifyPayment(authedFetch: AuthedFetch, orderId: string): Promise<PaymentOutcome> {
  const data = await authedFetch(`/cashfree/orders/${encodeURIComponent(orderId)}/verify`, { method: 'POST', body: '{}' });
  return data.status;
}

/**
 * Asks the server a few times while Cashfree finishes processing (UPI can take a few seconds).
 * Stops as soon as the payment is paid, failed or cancelled.
 */
export async function waitForPayment(
  check: () => Promise<PaymentOutcome>,
  { attempts = 6, delayMs = 2500, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<PaymentOutcome> {
  let outcome: PaymentOutcome = 'pending';
  for (let i = 0; i < attempts; i++) {
    outcome = await check();
    if (outcome !== 'pending') return outcome;
    if (i < attempts - 1) await sleep(delayMs);
  }
  return outcome;
}
