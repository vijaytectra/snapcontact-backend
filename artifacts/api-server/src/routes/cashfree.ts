import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { findOrderById, getOrders, saveOrders, findUserById, getUsers, saveUsers } from '../lib/storage';

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
    const orders = getOrders();
    orders.push({ orderId, userId: req.body?.userId || '', amount: payload.order_amount, currency: 'INR', paymentSessionId: data.payment_session_id, status: 'ACTIVE', createdAt: new Date().toISOString() });
    saveOrders(orders);
    return res.json({ orderId, paymentSessionId: data.payment_session_id, orderStatus: data.order_status });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Order creation failed' });
  }
});

webhookRouter.post('/webhooks/cashfree', (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', SECRET_KEY).update(timestamp + rawBody).digest('base64');
  if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
  const event = req.body;
  if (event?.type === 'PAYMENT_SUCCESS_WEBHOOK') {
    const orderId = event?.data?.order?.order_id;
    const order = findOrderById(orderId);
    if (order && order.status !== 'PAID') {
      order.status = 'PAID';
      order.cashfreePaymentId = event?.data?.payment?.cf_payment_id;
      const orders = getOrders().map(o => o.orderId === orderId ? order : o);
      saveOrders(orders);
      // activate subscription for user
      const users = getUsers();
      const idx = users.findIndex(u => u.id === order.userId);
      if (idx >= 0) {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 365*24*60*60*1000);
        users[idx].subscription = { status: 'annual', cashfreeOrderId: orderId, cashfreePaymentId: order.cashfreePaymentId, currentPeriodStart: now.toISOString(), currentPeriodEnd: periodEnd.toISOString() };
        saveUsers(users);
      }
    }
  }
  return res.status(200).json({ ok: true });
});

webhookRouter.get('/webhooks/cashfree', (_req: Request, res: Response) => {
  return res.json({ status: 'ok', message: 'Webhook endpoint ready. Cashfree sends POST requests here.' });
});

export default router;
