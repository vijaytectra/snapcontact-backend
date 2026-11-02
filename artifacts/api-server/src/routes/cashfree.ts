import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { findOrderById, insertOrder, updateOrder, updateUser } from '../lib/storage';

const router: Router = Router();
// Webhook routes are also mounted at /api so /api/webhooks/cashfree works as well as /api/cashfree/webhooks/cashfree.
export const webhookRouter: Router = Router();
router.use(webhookRouter);

const APP_ID = process.env.CASHFREE_APP_ID || '';
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';
const ENV = process.env.CASHFREE_ENV || 'SANDBOX';
const BASE_URL = ENV === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

router.post('/orders', async (req: Request, res: Response) => {
  const { customerEmail, customerName, customerPhone, amount } = req.body || {};
  if (!customerEmail) return res.status(400).json({ error: 'customerEmail required' });
  const orderId = `CF_ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const payload = {
    order_id: orderId,
    order_amount: amount || 99,
    order_currency: 'INR',
    customer_details: {
      customer_id: `cust_${Date.now()}`,
      customer_email: customerEmail,
      customer_phone: customerPhone || '9876543210',
      customer_name: customerName || customerEmail.split('@')[0],
    },
  };
  try {
    const cfRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': APP_ID,
        'x-client-secret': SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(payload),
    });
    const data: any = await cfRes.json();
    if (!cfRes.ok) return res.status(cfRes.status).json({ error: data?.message || 'Cashfree order failed', details: data });
    await insertOrder({ orderId, userId: req.body?.userId || '', amount: payload.order_amount, currency: 'INR', paymentSessionId: data.payment_session_id, status: 'ACTIVE', createdAt: new Date().toISOString(), cashfreePaymentId: null });
    return res.json({ orderId, paymentSessionId: data.payment_session_id, orderStatus: data.order_status });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Order creation failed' });
  }
});

webhookRouter.post('/webhooks/cashfree', async (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', SECRET_KEY).update(timestamp + rawBody).digest('base64');
  if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
  const event = req.body;
  if (event?.type === 'PAYMENT_SUCCESS_WEBHOOK') {
    const orderId = event?.data?.order?.order_id;
    const order = orderId ? await findOrderById(orderId) : undefined;
    if (order && order.status !== 'PAID') {
      const cashfreePaymentId = event?.data?.payment?.cf_payment_id != null ? String(event.data.payment.cf_payment_id) : null;
      await updateOrder(orderId, { status: 'PAID', cashfreePaymentId });
      // activate subscription for user
      if (order.userId) {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 365*24*60*60*1000);
        await updateUser(order.userId, { subscription: { status: 'annual', cashfreeOrderId: orderId, cashfreePaymentId, currentPeriodStart: now.toISOString(), currentPeriodEnd: periodEnd.toISOString() } });
      }
    }
  }
  return res.status(200).json({ ok: true });
});

webhookRouter.get('/webhooks/cashfree', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', message: 'Webhook endpoint ready. Cashfree sends POST requests here.' });
});

export default router;
