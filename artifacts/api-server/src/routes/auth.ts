import { Router, Request, Response, NextFunction } from 'express';
import { findUserByEmail, findUserById, insertUser, updateUser, saveVerification, findVerification, deleteVerification } from '../lib/storage';
import { hashPassword, verifyPassword, createToken, verifyToken, isValidEmail } from '../lib/auth';
import { sendOtpEmail, sendMagicLinkEmail } from '../lib/email';
import { rateLimit } from '../lib/rateLimit';
import { verifyGoogleIdToken } from '../lib/google';
import { AuthError, createAuthFlow } from '../lib/authFlow';

const router: Router = Router();

const flow = createAuthFlow({
  store: { findUserByEmail, findUserById, insertUser, updateUser, saveVerification, findVerification, deleteVerification },
  mailer: { sendOtp: sendOtpEmail, sendMagicLink: sendMagicLinkEmail },
  hashPassword, verifyPassword, createToken, verifyToken,
});

const TOO_MANY = { error: 'Too many requests. Try again later.' };
const ipOf = (req: Request) => req.ip || 'unknown';
const emailOf = (req: Request) => {
  const email = req.body?.email;
  return typeof email === 'string' && isValidEmail(email) ? email.trim() : null;
};
/** Runs a flow step and turns AuthError into its HTTP status. */
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((e) => {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message, code: e.code });
    return next(e);
  });

router.post('/signup', handle(async (req, res) => {
  const email = emailOf(req);
  if (!email) return res.status(400).json({ error: 'Invalid email' });
  if (!rateLimit(`otp-ip:${ipOf(req)}`, 10, 60000) || !rateLimit(`otp:${email.toLowerCase()}`, 5, 10 * 60000)) return res.status(429).json(TOO_MANY);
  // Same answer for new and existing emails; verifying the code signs in or creates the account.
  await flow.requestCode(email);
  return res.json({ pending: true, email });
}));

router.post('/request-otp', handle(async (req, res) => {
  const email = emailOf(req);
  if (!email) return res.status(400).json({ error: 'Invalid email' });
  if (!rateLimit(`otp-ip:${ipOf(req)}`, 10, 60000) || !rateLimit(`otp:${email.toLowerCase()}`, 5, 10 * 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.requestCode(email));
}));

router.post('/forgot-password', handle(async (req, res) => {
  const email = emailOf(req);
  if (!email) return res.status(400).json({ error: 'Invalid email' });
  if (!rateLimit(`otp-ip:${ipOf(req)}`, 10, 60000) || !rateLimit(`otp:${email.toLowerCase()}`, 5, 10 * 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.forgotPassword(email));
}));

router.post('/verify-otp', handle(async (req, res) => {
  const { otp, name } = req.body || {};
  const email = emailOf(req);
  if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });
  if (!rateLimit(`verify-ip:${ipOf(req)}`, 20, 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.verifyCode(email, String(otp), name));
}));

router.get('/verify-link', handle(async (req, res) => {
  const email = req.query.email;
  const token = req.query.token;
  if (typeof email !== 'string' || typeof token !== 'string') return res.status(400).json({ error: 'email and token required' });
  if (!rateLimit(`verify-ip:${ipOf(req)}`, 20, 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.verifyLink(email, token));
}));

// First step after the email: password screen for accounts with a password, otherwise an
// email code. `exists` stays true so older app builds go to the code step without learning
// whether the email is registered.
router.post('/check-email', handle(async (req, res) => {
  const email = emailOf(req);
  if (!email) return res.status(400).json({ error: 'Invalid email' });
  if (!rateLimit(`check:${ipOf(req)}`, 20, 60000)) return res.status(429).json(TOO_MANY);
  const { method } = await flow.checkEmail(email);
  return res.json({ method, exists: true });
}));

// Sign in with Google: the app sends the ID token Google gave it; we verify it with Google
// and only trust it when it was issued for one of our OAuth client IDs.
router.post('/google', handle(async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') return res.status(400).json({ error: 'idToken required' });
  if (!rateLimit(`google:${ipOf(req)}`, 10, 60000)) return res.status(429).json(TOO_MANY);
  const allowed = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (allowed.length === 0) return res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
  const info = await verifyGoogleIdToken(idToken);
  if (!info) return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  if (!allowed.includes(info.aud)) return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  if (info.email_verified !== true && info.email_verified !== 'true') return res.status(401).json({ error: 'Your Google email is not verified.' });
  const user = await flow.findOrCreateUser(info.email, info.name);
  // Google proves the email, so no password is required for Google sign-in.
  return res.json({ ...(await flow.startSession(user, 'google')), needsPassword: false });
}));

router.post('/login', handle(async (req, res) => {
  const email = emailOf(req);
  const password = req.body?.password;
  if (!email) return res.status(400).json({ error: 'Invalid email' });
  if (!rateLimit(`login-ip:${ipOf(req)}`, 30, 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.loginWithPassword(email, typeof password === 'string' ? password : ''));
}));

// Creates the password after the first code, or sets a new one after "forgot password".
router.post('/set-password', handle(async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing token' });
  if (!rateLimit(`set-password:${ipOf(req)}`, 10, 60000)) return res.status(429).json(TOO_MANY);
  return res.json(await flow.setPassword(token, req.body?.password));
}));

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' });
  const user = await findUserById(payload.userId);
  if (!user || user.refreshToken !== refreshToken) return res.status(401).json({ error: 'Refresh token revoked' });
  // Refreshed sessions never carry a code check, so they cannot change the password.
  const { token, refreshToken: newRefresh } = await flow.startSession(user, 'password');
  return res.json({ token, refreshToken: newRefresh });
});

router.get('/me', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const user = await findUserById(payload.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

export default router;
