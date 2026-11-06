import { Router, Request, Response, NextFunction } from 'express';
import {
  findOrderById, findOpenOrder, findUserById, insertOrder, setOrderStatus,
  activatePaidOrder, recordPaymentEvent, hasActivePlan,
} from '../lib/storage';
import { resolveCashfreeConfig } from '../lib/config';
import { cashfreeHttpClient, createPayments, PaymentError } from '../lib/payments';
import { rateLimit } from '../lib/rateLimit';
import { requireUser, type AuthedRequest } from '../lib/session';
import { PLANS } from '../lib/subscription';

const router: Router = Router();
// Webhook routes are also mounted at /api so /api/webhooks/cashfree works as well as /api/cashfree/webhooks/cashfree.
export const webhookRouter: Router = Router();
router.use(webhookRouter);

const config = resolveCashfreeConfig();
const payments = createPayments({
  config,
  cashfree: config ? cashfreeHttpClient(config) : null,
  store: {
    findUserById, findOrderById, findOpenOrder, setOrderStatus, activatePaidOrder, hasActivePlan,
    insertOrder: (o) => insertOrder({ ...o, paidAt: null }),
    recordEvent: recordPaymentEvent,
  },
});

/** Public https origin of this API, used for Cashfree's return and webhook URLs. */
function publicOrigin(req: Request) {
  const configured = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((e) => {
    if (e instanceof PaymentError) return res.status(e.status).json({ error: e.message, code: e.code });
    return next(e);
  });

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

router.get('/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS).map(({ id, name, amount, currency, durationDays }) => ({ id, name, amount, currency, durationDays })) });
});

// Starts checkout. The user comes from the session and the price from PLANS; anything
// else in the body (amount, userId, email) is ignored.
router.post('/orders', requireUser, handle(async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (!rateLimit(`order:${userId}`, 5, 10 * 60000)) return res.status(429).json({ error: 'Too many payment attempts. Try again in a few minutes.' });
  const origin = publicOrigin(req);
  const order = await payments.createOrder(userId, req.body?.plan ?? 'annual', req.body?.phone, {
    returnUrl: `${origin}/api/cashfree/return?order_id={order_id}`,
    notifyUrl: `${origin}/api/webhooks/cashfree`,
  });
  return res.json({ ...order, checkoutUrl: `${origin}/api/cashfree/checkout/${encodeURIComponent(order.orderId)}` });
}));

// After checkout: the app asks, we ask Cashfree. Only the order's owner can check it.
router.post('/orders/:orderId/verify', requireUser, handle(async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (!rateLimit(`verify-order:${userId}`, 30, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const status = await payments.verifyOrder(userId, String(req.params.orderId));
  return res.json({ status });
}));

// Hosted checkout page: loads Cashfree's official JS SDK (v3) and opens its checkout for the order.
router.get('/checkout/:orderId', handle(async (req, res) => {
  const session = await payments.checkoutSession(String(req.params.orderId));
  res.set('Cache-Control', 'no-store');
  if (!session) return res.status(404).type('html').send(page('Payment link expired', '<p>This payment link is no longer valid. Return to SnapContact and try again.</p>'));
  return res.type('html').send(page('Opening Cashfree…', `
    <p id="msg">Opening secure Cashfree checkout…</p>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <script>
      try {
        const cashfree = Cashfree({ mode: ${JSON.stringify(session.mode)} });
        cashfree.checkout({ paymentSessionId: ${JSON.stringify(session.paymentSessionId)}, redirectTarget: '_self' });
      } catch (e) {
        document.getElementById('msg').textContent = 'Could not open Cashfree checkout. Return to SnapContact and try again.';
      }
    </script>`));
}));

// Cashfree sends the browser here after checkout. Nothing is activated here; the app verifies.
router.get('/return', (req, res) => {
  const orderId = typeof req.query.order_id === 'string' ? req.query.order_id : '';
  const deepLink = `snapcontact://payment?order_id=${encodeURIComponent(orderId)}`;
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(page('Returning to SnapContact', `
    <p>Checking your payment in SnapContact…</p>
    <p><a href="${escapeHtml(deepLink)}">Return to SnapContact</a></p>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>`));
});

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#091838;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}a{color:#8AB4F8}</style>
</head><body><main>${body}</main></body></html>`;
}

// Signed Cashfree notification. Verified against the exact raw body, then re-checked with Cashfree.
webhookRouter.post('/webhooks/cashfree', handle(async (req, res) => {
  const result = await payments.handleWebhook(
    (req as any).rawBody,
    req.headers['x-webhook-signature'],
    req.headers['x-webhook-timestamp'],
  );
  return res.status(result.status).json(result.body);
}));

webhookRouter.get('/webhooks/cashfree', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', message: 'Webhook endpoint ready. Cashfree sends POST requests here.' });
});

export default router;
