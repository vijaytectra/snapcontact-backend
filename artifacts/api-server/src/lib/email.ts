import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  },
});

export async function sendOtpEmail(to: string, otp: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"SnapContact" <${from}>`,
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

export async function sendMagicLinkEmail(to: string, link: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"SnapContact" <${from}>`,
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
