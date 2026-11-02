import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { findUserByEmail, findUserById, getUsers, saveUsers, getVerifications, saveVerifications } from '../lib/storage';
import { hashPassword, verifyPassword, createToken, verifyToken, isValidEmail } from '../lib/auth';
import { sendOtpEmail, sendMagicLinkEmail } from '../lib/email';
import { rateLimit } from '../lib/rateLimit';

const router: Router = Router();
const ACCESS_TTL = 15 * 60 * 1000; // 15 min
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function genOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }

function issueTokens(user: any) {
  const accessToken = createToken({ userId: user.id, email: user.email, type: 'access' }, ACCESS_TTL);
  const refreshToken = createToken({ userId: user.id, email: user.email, type: 'refresh' }, REFRESH_TTL);
  return { accessToken, refreshToken };
}

router.post('/signup', async (req: Request, res: Response) => {
  const { email, name } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`signup:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const existing = findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'User already exists' });
  const otp = genOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.scryptSync(otp, salt, 64).toString('hex');
  const magicToken = genToken();
  const verifications = getVerifications().filter(v => v.email.toLowerCase() !== email.toLowerCase());
  verifications.push({ email: email.trim(), otpHash, salt, expiresAt: new Date(Date.now() + 10*60*1000).toISOString(), magicToken });
  saveVerifications(verifications);
  const link = `snapcontact://verify?email=${encodeURIComponent(email.trim())}&token=${magicToken}`;
  try {
    await sendOtpEmail(email.trim(), otp);
    await sendMagicLinkEmail(email.trim(), link);
  } catch (e: any) {
    console.error('Email send failed:', e?.message);
  }
  return res.json({ pending: true, email: email.trim() });
});

router.post('/request-otp', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`otp:${email}:${ip}`, 3, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const otp = genOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.scryptSync(otp, salt, 64).toString('hex');
  const magicToken = genToken();
  const verifications = getVerifications().filter(v => v.email.toLowerCase() !== email.toLowerCase());
  verifications.push({ email: email.trim(), otpHash, salt, expiresAt: new Date(Date.now() + 10*60*1000).toISOString(), magicToken });
  saveVerifications(verifications);
  const link = `snapcontact://verify?email=${encodeURIComponent(email.trim())}&token=${magicToken}`;
  try {
    await sendOtpEmail(email.trim(), otp);
    await sendMagicLinkEmail(email.trim(), link);
  } catch (e: any) {
    console.error('Email send failed:', e?.message);
  }
  return res.json({ sent: true });
});

router.post('/verify-otp', (req: Request, res: Response) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`verify:${email}:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const verifications = getVerifications();
  const v = verifications.find(x => x.email.toLowerCase() === email.toLowerCase());
  if (!v) return res.status(400).json({ error: 'No pending verification' });
  if (new Date(v.expiresAt) < new Date()) return res.status(400).json({ error: 'OTP expired' });
  const computed = crypto.scryptSync(String(otp), v.salt, 64).toString('hex');
  if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v.otpHash))) return res.status(400).json({ error: 'Invalid OTP' });
  let user = findUserByEmail(email);
  if (!user) {
    const { salt, hash } = hashPassword('');
    user = { id: `usr_${Date.now()}`, email: email.trim(), name: email.split('@')[0], passwordHash: hash, salt, createdAt: new Date().toISOString(), verified: true, subscription: { status: 'trial', trialStartDate: new Date().toISOString(), trialEndDate: new Date(Date.now() + 7*24*60*60*1000).toISOString() } };
    const users = getUsers();
    users.push(user);
    saveUsers(users);
  } else {
    user!.verified = true;
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user!.id);
    if (idx >= 0) { users[idx] = user!; saveUsers(users); }
  }
  saveVerifications(verifications.filter(x => x.email.toLowerCase() !== email.toLowerCase()));
  const { accessToken, refreshToken } = issueTokens(user!);
  user.refreshToken = refreshToken;
  const users2 = getUsers();
  const idx2 = users2.findIndex(u => u.id === user.id);
  if (idx2 >= 0) { users2[idx2] = user; saveUsers(users2); }
  return res.json({ token: accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

router.get('/verify-link', (req: Request, res: Response) => {
  const email = req.query.email as string;
  const token = req.query.token as string;
  if (!email || !token) return res.status(400).json({ error: 'email and token required' });
  const verifications = getVerifications();
  const v = verifications.find(x => x.email.toLowerCase() === email.toLowerCase() && x.magicToken === token);
  if (!v) return res.status(400).json({ error: 'Invalid or expired link' });
  if (new Date(v.expiresAt) < new Date()) return res.status(400).json({ error: 'Link expired' });
  let user = findUserByEmail(email);
  if (!user) {
    const { salt, hash } = hashPassword('');
    user = { id: `usr_${Date.now()}`, email: email.trim(), name: email.split('@')[0], passwordHash: hash, salt, createdAt: new Date().toISOString(), verified: true, subscription: { status: 'trial', trialStartDate: new Date().toISOString(), trialEndDate: new Date(Date.now() + 7*24*60*60*1000).toISOString() } };
    const users = getUsers();
    users.push(user);
    saveUsers(users);
  } else {
    user!.verified = true;
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user!.id);
    if (idx >= 0) { users[idx] = user!; saveUsers(users); }
  }
  saveVerifications(verifications.filter(x => x.email.toLowerCase() !== email.toLowerCase()));
  const { accessToken, refreshToken } = issueTokens(user!);
  user.refreshToken = refreshToken;
  const users2 = getUsers();
  const idx2 = users2.findIndex(u => u.id === user.id);
  if (idx2 >= 0) { users2[idx2] = user; saveUsers(users2); }
  return res.json({ token: accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  const ip = req.ip || 'unknown';
  if (!rateLimit(`login:${email}:${ip}`, 5, 60000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.verified) return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
  if (!verifyPassword(password || '', user.salt, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const { accessToken, refreshToken } = issueTokens(user!);
  user.refreshToken = refreshToken;
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) { users[idx] = user; saveUsers(users); }
  return res.json({ token: accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  const payload = verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' });
  const user = findUserById(payload.userId);
  if (!user || user.refreshToken !== refreshToken) return res.status(401).json({ error: 'Refresh token revoked' });
  const { accessToken, refreshToken: newRefresh } = issueTokens(user!);
  user.refreshToken = newRefresh;
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) { users[idx] = user; saveUsers(users); }
  return res.json({ token: accessToken, refreshToken: newRefresh });
});

router.get('/me', (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  const user = findUserById(payload.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } });
});

export default router;
