import crypto from 'node:crypto';
import type { CashfreeConfig } from './config';
import { getPlan, type Plan, type PlanId } from './subscription';

/**
 * Payments through Cashfree Payment Gateway (API version 2023-08-01):
 *   1. createOrder   - signed-in user picks a plan; price comes from PLANS; order stored, then
 *                      Cashfree's hosted checkout collects the payment (no card data touches us).
 *   2. verifyOrder   - after checkout the app asks us; we ask Cashfree, never trust the client.
 *   3. handleWebhook - Cashfree's signed notification; verified, then re-checked with Cashfree.
 * Activation happens only in activateIfPaid, which checks amount, currency and owner, and is
 * idempotent (the database update only succeeds once per order).
 */

export type OrderRow = {
  orderId: string;
  userId: string;
  plan: string | null;
  amount: number;
  currency: string;
  paymentSessionId: string;
  status: 'ACTIVE' | 'PAID' | 'EXPIRED' | 'FAILED';
  createdAt: string;
  cashfreePaymentId: string | null;
};

export type PaymentsStore = {
  findUserById(id: string): Promise<{ id: string; email: string; name: string } | undefined>;
  findOrderById(id: string): Promise<OrderRow | undefined>;
  findOpenOrder(userId: string, plan: PlanId): Promise<OrderRow | undefined>;
  insertOrder(order: OrderRow): Promise<void>;
  setOrderStatus(orderId: string, status: 'EXPIRED' | 'FAILED'): Promise<void>;
  /** Marks the order PAID and activates the plan in one transaction. False if it was already paid. */
  activatePaidOrder(orderId: string, paymentId: string, plan: Plan, now: number): Promise<boolean>;
  /** Records a webhook delivery. False when this exact event was already recorded. */
  recordEvent(eventKey: string, orderId: string, type: string, status: string): Promise<boolean>;
  hasActivePlan(userId: string, now: number): Promise<boolean>;
};

export type CashfreeOrderResponse = {
  order_id: string; order_amount: number; order_currency: string; order_status: string;
  payment_session_id?: string; customer_details?: { customer_id?: string };
};
export type CashfreePayment = {
  cf_payment_id: string | number; payment_status: string; payment_amount: number; payment_currency: string;
};
export type CashfreeClient = {
  createOrder(body: object): Promise<CashfreeOrderResponse>;
  getOrder(orderId: string): Promise<CashfreeOrderResponse>;
  getPayments(orderId: string): Promise<CashfreePayment[]>;
};

export class PaymentError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type PaymentOutcome = 'paid' | 'pending' | 'failed' | 'cancelled';

const NOT_CONFIGURED = () => new PaymentError(503, 'Payments are not available right now. Please try again later.', 'PAYMENTS_NOT_CONFIGURED');
// A checkout session for an unpaid order is reused for this long instead of opening a second order.
const REUSE_OPEN_ORDER_MS = 30 * 60 * 1000;

/** Cashfree's documented signature: base64(HMAC-SHA256(timestamp + rawBody, client secret)). */
export function cashfreeSignature(timestamp: string, rawBody: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
}

export function createPayments(deps: {
  store: PaymentsStore;
  cashfree: CashfreeClient | null;
  config: CashfreeConfig | null;
  now?: () => number;
}) {
  const { store } = deps;
  const now = deps.now ?? Date.now;

  function requireConfigured() {
    if (!deps.config || !deps.cashfree) throw NOT_CONFIGURED();
    return { config: deps.config, cashfree: deps.cashfree };
  }

  /** Activates only when Cashfree reports a successful payment of the exact order amount. */
  async function activateIfPaid(order: OrderRow): Promise<PaymentOutcome> {
    if (order.status === 'PAID') return 'paid';
    const { cashfree } = requireConfigured();
    const plan = getPlan(order.plan);
    if (!plan) throw new PaymentError(409, 'This order is for an unknown plan.', 'UNKNOWN_PLAN');
    const remote = await cashfree.getOrder(order.orderId);
    if (remote.order_id !== order.orderId || remote.order_currency !== order.currency || Number(remote.order_amount) !== order.amount) {
      throw new PaymentError(409, 'Payment details do not match this order.', 'ORDER_MISMATCH');
    }
    if (remote.customer_details?.customer_id && remote.customer_details.customer_id !== order.userId) {
      throw new PaymentError(409, 'Payment details do not match this order.', 'ORDER_MISMATCH');
    }
    if (remote.order_status === 'PAID') {
      const payments = await cashfree.getPayments(order.orderId);
      const ok = payments.find((p) => p.payment_status === 'SUCCESS'
        && Number(p.payment_amount) === order.amount && p.payment_currency === order.currency);
      if (!ok) throw new PaymentError(409, 'Cashfree has no matching successful payment for this order.', 'NO_MATCHING_PAYMENT');
      await store.activatePaidOrder(order.orderId, String(ok.cf_payment_id), plan, now());
      return 'paid';
    }
    if (remote.order_status === 'EXPIRED' || remote.order_status === 'TERMINATED') {
      await store.setOrderStatus(order.orderId, 'EXPIRED');
      return 'failed';
    }
    // ACTIVE: no successful payment yet. Report the latest attempt so the app can say why.
    const payments = await cashfree.getPayments(order.orderId).catch(() => [] as CashfreePayment[]);
    const last = payments.at(-1)?.payment_status;
    if (last === 'USER_DROPPED' || last === 'CANCELLED') return 'cancelled';
    if (last === 'FAILED') return 'failed';
    return 'pending';
  }

  return {
    /** Starts checkout for the signed-in user. The price is the server's, never the client's. */
    async createOrder(userId: string, planId: unknown, phone: unknown, urls: { returnUrl: string; notifyUrl: string }) {
      const { config, cashfree } = requireConfigured();
      const plan = getPlan(planId);
      if (!plan) throw new PaymentError(400, 'Choose a valid plan.', 'INVALID_PLAN');
      const digits = typeof phone === 'string' ? phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') : '';
      if (!/^[6-9]\d{9}$/.test(digits)) throw new PaymentError(400, 'Enter a valid 10-digit Indian mobile number for the payment receipt.', 'INVALID_PHONE');
      const user = await store.findUserById(userId);
      if (!user) throw new PaymentError(401, 'Your session has expired. Sign in again.', 'BAD_TOKEN');
      if (await store.hasActivePlan(userId, now())) throw new PaymentError(409, 'Your Annual Pro plan is already active.', 'ALREADY_ACTIVE');

      const open = await store.findOpenOrder(userId, plan.id);
      if (open && now() - Date.parse(open.createdAt) < REUSE_OPEN_ORDER_MS) {
        return { orderId: open.orderId, paymentSessionId: open.paymentSessionId, amount: open.amount, currency: open.currency, environment: config.env };
      }

      const orderId = `SC_${now()}_${crypto.randomBytes(6).toString('hex')}`;
      const remote = await cashfree.createOrder({
        order_id: orderId,
        order_amount: plan.amount,
        order_currency: plan.currency,
        customer_details: { customer_id: user.id, customer_email: user.email, customer_phone: digits, customer_name: user.name.slice(0, 100) },
        order_meta: {
          return_url: urls.returnUrl.replace('{order_id}', encodeURIComponent(orderId)).replace('%7Border_id%7D', encodeURIComponent(orderId)),
          notify_url: urls.notifyUrl,
        },
        order_note: plan.name,
      });
      if (!remote.payment_session_id || remote.order_id !== orderId || Number(remote.order_amount) !== plan.amount) {
        throw new PaymentError(502, 'Payment provider returned an unexpected response.', 'PROVIDER_ERROR');
      }
      await store.insertOrder({
        orderId, userId: user.id, plan: plan.id, amount: plan.amount, currency: plan.currency,
        paymentSessionId: remote.payment_session_id, status: 'ACTIVE', createdAt: new Date(now()).toISOString(), cashfreePaymentId: null,
      });
      return { orderId, paymentSessionId: remote.payment_session_id, amount: plan.amount, currency: plan.currency, environment: config.env };
    },

    /** Checks an order with Cashfree for its owner and activates the plan when paid. */
    async verifyOrder(userId: string, orderId: string): Promise<PaymentOutcome> {
      requireConfigured();
      const order = await store.findOrderById(orderId);
      // Someone else's order looks exactly like a missing one.
      if (!order || order.userId !== userId) throw new PaymentError(404, 'Order not found.', 'ORDER_NOT_FOUND');
      return activateIfPaid(order);
    },

    /** Session id for the hosted checkout page; only for unpaid orders. */
    async checkoutSession(orderId: string) {
      const { config } = requireConfigured();
      const order = await store.findOrderById(orderId);
      if (!order || order.status !== 'ACTIVE') return null;
      return { paymentSessionId: order.paymentSessionId, mode: config.env === 'PRODUCTION' ? 'production' : 'sandbox' as const };
    },

    /**
     * Cashfree webhook. Fails closed without a secret, rejects bad signatures and payloads,
     * ignores duplicates, and re-checks the order with Cashfree before activating anything.
     */
    async handleWebhook(rawBody: string | undefined, signature: unknown, timestamp: unknown): Promise<{ status: number; body: object }> {
      if (!deps.config || !deps.cashfree) return { status: 503, body: { error: 'Payments are not configured.' } };
      if (typeof rawBody !== 'string' || !rawBody || typeof signature !== 'string' || typeof timestamp !== 'string' || !timestamp) {
        return { status: 400, body: { error: 'Missing signature headers or body.' } };
      }
      const expected = Buffer.from(cashfreeSignature(timestamp, rawBody, deps.config.secretKey));
      const given = Buffer.from(signature);
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        return { status: 401, body: { error: 'Invalid signature.' } };
      }

      let event: any;
      try { event = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'Malformed payload.' } }; }
      const type = event?.type;
      const orderData = event?.data?.order;
      const payment = event?.data?.payment;
      const orderId = orderData?.order_id;
      if (typeof type !== 'string' || typeof orderId !== 'string' || !payment) {
        // Signed but not a payment event we handle (for example a test ping): acknowledge it.
        return { status: 200, body: { ok: true, ignored: true } };
      }
      const order = await store.findOrderById(orderId);
      if (!order) return { status: 404, body: { error: 'Unknown order.' } };
      const customerId = event?.data?.customer_details?.customer_id;
      if (Number(orderData.order_amount) !== order.amount || orderData.order_currency !== order.currency
        || (customerId !== undefined && customerId !== order.userId)) {
        return { status: 400, body: { error: 'Payload does not match the order.' } };
      }

      // Cashfree payment ids can exceed JavaScript's safe integers; take the digits from the raw body.
      const exactId = /"cf_payment_id"\s*:\s*"?(\d+)/.exec(rawBody)?.[1];
      const paymentId = exactId ?? String(payment.cf_payment_id ?? '');
      const eventKey = `${type}:${orderId}:${paymentId}`;
      const status = String(payment.payment_status ?? '');

      if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
        if (status !== 'SUCCESS' || Number(payment.payment_amount) !== order.amount || payment.payment_currency !== order.currency) {
          return { status: 400, body: { error: 'Payment does not match the order.' } };
        }
        let outcome: PaymentOutcome;
        try {
          // Already-paid orders return at once; activation itself can only happen once.
          outcome = await activateIfPaid(order);
        } catch (e) {
          if (e instanceof PaymentError) return { status: 400, body: { error: e.message } };
          throw e;
        }
        // Recorded only after it was handled, so a failed first attempt is retried by Cashfree.
        const fresh = await store.recordEvent(eventKey, orderId, type, status);
        return { status: 200, body: { ok: true, outcome, ...(fresh ? {} : { duplicate: true }) } };
      }
      const fresh = await store.recordEvent(eventKey, orderId, type, status);
      if (!fresh) return { status: 200, body: { ok: true, duplicate: true } };
      if (type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
        // The order stays open: the user may retry with another method in the same checkout.
        return { status: 200, body: { ok: true, outcome: type === 'PAYMENT_FAILED_WEBHOOK' ? 'failed' : 'cancelled' } };
      }
      return { status: 200, body: { ok: true } };
    },
  };
}

export type Payments = ReturnType<typeof createPayments>;

/** Cashfree REST client using API version 2023-08-01 and the server's credentials. */
export function cashfreeHttpClient(config: CashfreeConfig, fetchImpl: typeof fetch = fetch): CashfreeClient {
  async function call(method: 'GET' | 'POST', path: string, body?: object) {
    const res = await fetchImpl(`${config.apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': '2023-08-01',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Cashfree's message is safe to log; the request never contained card data.
      console.error(`Cashfree ${method} ${path} failed: ${res.status} ${data?.code ?? ''} ${data?.message ?? ''}`);
      throw new PaymentError(502, 'The payment provider could not process this request. Please try again.', 'PROVIDER_ERROR');
    }
    return data;
  }
  return {
    createOrder: (body) => call('POST', '/orders', body),
    getOrder: (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}`),
    getPayments: (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`),
  };
}
