import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { listUsers, listOrders, findUserById, updateUser } from '../lib/storage';
import { newTrial } from '../lib/subscription';

const router: Router = Router();

// Read-only views of users and orders. Disabled unless ADMIN_KEY is set; pass the key
// as an x-admin-key header.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY || '';
  if (!expected) return res.status(404).json({ error: 'Not found' });
  const given = String(req.headers['x-admin-key'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid admin key' });
  return next();
}

router.use(requireAdmin);

router.get('/users', async (_req: Request, res: Response) => {
  const users = await listUsers();
  return res.json({
    count: users.length,
    users: users.map(u => ({ id: u.id, email: u.email, name: u.name, verified: u.verified, createdAt: u.createdAt, subscription: u.subscription })),
  });
});

router.get('/orders', async (_req: Request, res: Response) => {
  const orders = await listOrders();
  return res.json({ count: orders.length, orders });
});

// Support tool: gives a user a fresh 7-day trial. Admin key only; the app has no way to do this.
router.post('/users/:id/reset-trial', async (req: Request, res: Response) => {
  const user = await findUserById(String(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  const current = (user.subscription && typeof user.subscription === 'object' ? user.subscription : {}) as Record<string, unknown>;
  if (current.status === 'annual') return res.status(409).json({ error: 'User has a paid plan; trial not changed.' });
  await updateUser(user.id, { subscription: newTrial(Date.now()) });
  return res.json({ ok: true });
});

export default router;
