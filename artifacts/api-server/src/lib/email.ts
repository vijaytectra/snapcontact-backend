import nodemailer from 'nodemailer';

// Pooled transporter with direct SSL for fast delivery and connection reuse.
const port = Number(process.env.SMTP_PORT || 465);
const secure = process.env.SMTP_SECURE === 'true' || port === 465;

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 3,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  },
});

type Mail = { to: string; subject: string; text: string; html: string };

// Sends over HTTPS through Brevo when BREVO_API_KEY is set, otherwise over SMTP.
async function deliver({ to, subject, text, html }: Mail) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SnapContact', email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    return;
  }
  await transporter.sendMail({ from: `"SnapContact" <${from}>`, to, subject, text, html });
}

export async function sendOtpEmail(to: string, otp: string) {
  await deliver({
    to,
    subject: 'Your SnapContact verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>SnapContact</h2>
      <p>Your verification code is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;padding:16px 0">${otp}</div>
      <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>`,
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The username and password, sent once after the sign-up's email is confirmed. */
export async function sendCredentialsEmail(to: string, username: string, password: string) {
  await deliver({
    to,
    subject: 'Your SnapContact login details',
    text: `Your SnapContact account is ready.\n\nUsername: ${username}\nPassword: ${password}\n\nKeep this email somewhere safe. If you did not create this account, ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>SnapContact</h2>
      <p>Your account is ready. Keep these login details safe:</p>
      <table style="font-size:16px;padding:8px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Username</td><td style="font-weight:bold">${escapeHtml(username)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Password</td><td style="font-weight:bold">${escapeHtml(password)}</td></tr>
      </table>
      <p style="font-size:12px;color:#666">If you did not create this account, ignore this email.</p>
    </div>`,
  });
}

export async function sendMagicLinkEmail(to: string, link: string) {
  await deliver({
    to,
    subject: 'Sign in to SnapContact',
    text: `Click this link to sign in: ${link}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>SnapContact</h2>
      <p>Click the button below to sign in:</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Sign in to SnapContact</a>
      <p style="margin-top:16px;font-size:12px;color:#666">Or copy this link: ${link}</p>
    </div>`,
  });
}
