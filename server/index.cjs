const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1);

const REQUIRED_ENV = ['PORT', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_EMAIL', 'TURNSTILE_SECRET_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT, 10);
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'EduChain Contact';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const RATE_LIMIT_MAX = parseInt(process.env.CONTACT_RATE_LIMIT || '3', 10);

app.use(express.json({ limit: '50kb' }));

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now - record.firstRequest > RATE_LIMIT_WINDOW) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

transporter.verify((err) => {
  if (err) console.error('SMTP connection error:', err.message);
  else console.log('SMTP connection verified.');
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/contact', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const { name, email, subject, message, website, turnstileToken } = req.body || {};

  if (typeof website === 'string' && website.length > 0) {
    return res.json({ success: true });
  }

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (typeof name !== 'string' || name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'invalid_name' });
  }
  if (typeof email !== 'string' || !emailRegex.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (typeof subject !== 'string' || subject.length < 2 || subject.length > 200) {
    return res.status(400).json({ error: 'invalid_subject' });
  }
  if (typeof message !== 'string' || message.length < 20 || message.length > 5000) {
    return res.status(400).json({ error: 'invalid_message' });
  }

  if (!turnstileToken) {
    return res.status(400).json({ error: 'turnstile_required' });
  }
  const turnstileValid = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileValid) {
    return res.status(403).json({ error: 'turnstile_failed' });
  }

  try {
    await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to: CONTACT_EMAIL,
      replyTo: `${name} <${email}>`,
      subject: `[EduChain] ${subject}`,
      text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1D9E75;">New Contact — EduChain</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; width: 100px;">Name:</td>
              <td style="padding: 8px;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Email:</td>
              <td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666;">Subject:</td>
              <td style="padding: 8px;">${escapeHtml(subject)}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">
            Sent from educhain.gembait.com · IP: ${escapeHtml(ip)}
          </p>
        </div>
      `,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('sendMail failed:', err);
    res.status(500).json({ error: 'send_failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`EduChain API listening on 127.0.0.1:${PORT}`);
});
