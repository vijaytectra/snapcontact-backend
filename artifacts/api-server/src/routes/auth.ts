import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { findUserByEmail, findUserById, insertUser, updateUser, saveVerification, findVerification, deleteVerification } from '../lib/storage';
import { hashPassword, verifyPassword, createToken, verifyToken, isValidEmail } from '../lib/auth';
import { sendOtpEmail, sendMagicLinkEmail } from '../lib/email';
import { rateLimit } from '../lib/rateLimit';
import { verifyGoogleIdToken } from '../lib/google';

const router: Router = Router();
const ACCESS_TTL = 15 * 60 * 1000; // 15 min
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }

function issueTokens(user: { id: string; email: string }) {
  const accessToken = createToken({ userId: user.id, email: user.email, type: 'access' }, ACCESS_TTL);
  const refreshToken = createToken({ userId: user.id, email: user.email, type: 'refresh' }, REFRESH_TTL);
  return { accessToken, refreshToken };
}

// Marks the email verified (creating the account with a 7-day trial on first sign-in) and issues tokens.
async function findOrCreateUser(email: string, name?: string) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { salt, hash } = hashPassword('');
    const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : email.split('@')[0];
    user = { id: `usr_${Date.now()}`, email: email.trim(), name: cleanName, passwordHash: hash, salt, createdAt: new Date().toISOString(), verified: true, refreshToken: null, subscription: { status: 'trial', trialStartDate: new Date().toISOString(), trialEndDate: new Date(Date.now() + 7*24*60*60*1000).toISOString() } };
    await insertUser(user);
  }
  return user;
}

async function startSession(user: { id: string; email: string; name: string; subscription: any }) {
  const { accessToken, refreshToken } = issueTokens(user);
  await updateUser(user.id, { verified: true, refreshToken });
  return { token: accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } };
}

async function completeVerification(email: string, name?: string) {
  const user = await findOrCreateUser(email, name);
  await deleteVerification(email);
  return startSession(user);
}

async function startVerification(email: string) {
  const otp = genOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.scryptSync(otp, salt, 64).toString('hex');
  const magicToken = genToken();
  await saveVerification({ email: email.trim(), otpHash, salt, expiresAt: new Date(Date.now() + 10*60*1000).toISOString(), magicToken });
  const link = `snapcontact://verify?email=${encodeURIComponent(email.trim())}&token=${magicToken}`;
  try {
    await sendOtpEmail(email.trim(), otp);
    await sendMagicLinkEmail(email.trim(), link);
  } catch (e: any) {
    console.error('Email send failed:', e?.message);
  }
}

router.post('/signup', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`signup:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  if (await findUserByEmail(email)) return res.status(409).json({ error: 'User already exists' });
  await startVerification(email);
  return res.json({ pending: true, email: email.trim() });
});

router.post('/request-otp', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`otp:${email}:${ip}`, 3, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  // mode is optional so older app builds keep working (sign in or create, as before).
  const mode = req.body?.mode;
  if (mode === 'signin' || mode === 'signup') {
    const exists = !!(await findUserByEmail(email));
    if (mode === 'signin' && !exists) return res.status(404).json({ error: 'No account found for this email.', code: 'NO_ACCOUNT' });
    if (mode === 'signup' && exists) return res.status(409).json({ error: 'An account already exists for this email. Sign in instead.', code: 'ACCOUNT_EXISTS' });
  }
  await startVerification(email);
  return res.json({ sent: true });
});

router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, otp, name } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`verify:${email}:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const v = await findVerification(email);
  if (!v) return res.status(400).json({ error: 'No pending verification' });
  if (new Date(v.expiresAt) < new Date()) return res.status(400).json({ error: 'OTP expired' });
  const computed = crypto.scryptSync(String(otp), v.salt, 64).toString('hex');
  if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v.otpHash))) return res.status(400).json({ error: 'Invalid OTP' });
  return res.json(await completeVerification(email, name));
});

router.get('/verify-link', async (req: Request, res: Response) => {
  const email = req.query.email as string;
  const token = req.query.token as string;
  if (!email || !token) return res.status(400).json({ error: 'email and token required' });
  const v = await findVerification(email);
  if (!v || v.magicToken !== token) return res.status(400).json({ error: 'Invalid or expired link' });
  if (new Date(v.expiresAt) < new Date()) return res.status(400).json({ error: 'Link expired' });
  return res.json(await completeVerification(email));
});

// Google-style first step: tell the app whether to show "sign in" or "create account".
router.post('/check-email', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`check:${ip}`, 20, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const user = await findUserByEmail(email);
  return res.json({ exists: !!user });
});

// Sign in with Google: the app sends the ID token Google gave it; we verify it with Google
// and only trust it when it was issued for one of our OAuth client IDs.
router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') return res.status(400).json({ error: 'idToken required' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`google:${ip}`, 10, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const allowed = (process.env.GOOGLE_CLIENT_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (allowed.length === 0) return res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
  const info = await verifyGoogleIdToken(idToken);
  if (!info) return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  if (!allowed.includes(info.aud)) return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  if (info.email_verified !== true && info.email_verified !== 'true') return res.status(401).json({ error: 'Your Google email is not verified.' });
  const user = await findOrCreateUser(info.email, info.name);
  return res.json(await startSession(user));
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`login:${email}:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.verified) return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
  if (!verifyPassword(password || '', user.salt, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const { accessToken, refreshToken } = issueTokens(user);
  await updateUser(user.id, { refreshToken });
  return res.json({ token: accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' });
  const user = await findUserById(payload.userId);
  if (!user || user.refreshToken !== refreshToken) return res.status(401).json({ error: 'Refresh token revoked' });
  const { accessToken, refreshToken: newRefresh } = issueTokens(user);
  await updateUser(user.id, { refreshToken: newRefresh });
  return res.json({ token: accessToken, refreshToken: newRefresh });
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
