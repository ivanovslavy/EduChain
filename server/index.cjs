const express = require('express');
const nodemailer = require('nodemailer');
const { ethers } = require('ethers');
// т.4 (2026-10-31): the uploader now sniffs the bytes and strips metadata before anything is pinned.
const { cleanImage, findMetadata } = require('./lib/imageMetadata.cjs');

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

const smallJson = express.json({ limit: '50kb' });
app.use((req, res, next) => (
  req.path.startsWith('/api/ipfs/') || req.path.startsWith('/api/certificates/')
    ? next()
    : smallJson(req, res, next)));

// ── Self-hosted IPFS (Kubo on 127.0.0.1:5001; public gateway ipfs.gembait.com) ──
const IPFS_API = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.gembait.com/ipfs';
const ipfsJson = express.json({ limit: '8mb' });
const IMG_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const ipfsRate = new Map();
function ipfsRateOk(ip) {
  const now = Date.now();
  const max = parseInt(process.env.IPFS_RATE_LIMIT || '30', 10);
  const r = ipfsRate.get(ip);
  if (!r || now - r.t > RATE_LIMIT_WINDOW) { ipfsRate.set(ip, { c: 1, t: now }); return true; }
  if (r.c >= max) return false;
  r.c++; return true;
}
// ── Who may pin to our node? (т.4) ───────────────────────────────────────────────────────────────
// The answer is read FROM THE CHAIN: the Whitelist contract that already governs every other
// member-only surface. The caller proves the address with a signature over a canonical message that
// includes a sha256 of the image, so a captured signature cannot be replayed with a different file.
const CHAIN_ID = parseInt(process.env.CERT_CHAIN_ID || '821207', 10);
const RPC_URLS = (process.env.CERT_RPC_URLS || 'https://rpc1.gembascan.io,https://rpc2.gembascan.io')
  .split(',').map((x) => x.trim()).filter(Boolean);
const WHITELIST_ADDRESS = process.env.IPFS_WHITELIST_ADDRESS || '0x76D8ddb79F91df2FB494Ef5375A67F778860AcFE';
const WHITELIST_ABI = [
  'function checkWhitelist(address) view returns (bool)',
  'function isAdmin(address) view returns (bool)',
  'function owner() view returns (address)',
];
let _provider = null;
function chainProvider() {
  if (_provider) return _provider;
  const cfgs = RPC_URLS.map((url, i) => ({
    provider: new ethers.JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true }),
    priority: i + 1, stallTimeout: 4000, weight: 1,
  }));
  _provider = cfgs.length > 1 ? new ethers.FallbackProvider(cfgs, CHAIN_ID, { quorum: 1 }) : cfgs[0].provider;
  return _provider;
}

/** The exact text an uploader signs. The image hash is in it, so one signature fits one file. */
function uploadMessage(address, imageSha256) {
  return [
    'EduChain IPFS upload',
    `address: ${String(address).toLowerCase()}`,
    `image: ${imageSha256}`,
  ].join('\n');
}

/**
 * Verify the signature and the on-chain membership. Returns {ok, address} or {ok:false, error}.
 * FAIL CLOSED: if the chain cannot be reached we refuse the upload rather than pin on trust.
 */
async function authorizeUpload(signature, address, imageSha256) {
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return { ok: false, error: 'signature_required' };
  if (!ethers.isAddress(address || '')) return { ok: false, error: 'address_required' };
  let signer;
  try { signer = ethers.verifyMessage(uploadMessage(address, imageSha256), signature); }
  catch { return { ok: false, error: 'invalid_signature' }; }
  if (signer.toLowerCase() !== String(address).toLowerCase()) return { ok: false, error: 'signature_mismatch' };
  try {
    const wl = new ethers.Contract(WHITELIST_ADDRESS, WHITELIST_ABI, chainProvider());
    const [listed, admin, owner] = await Promise.all([
      wl.checkWhitelist(signer).catch(() => false),
      wl.isAdmin(signer).catch(() => false),
      wl.owner().catch(() => ethers.ZeroAddress),
    ]);
    if (!listed && !admin && String(owner).toLowerCase() !== signer.toLowerCase()) {
      return { ok: false, error: 'not_whitelisted', address: signer };
    }
    return { ok: true, address: signer };
  } catch (e) {
    console.error('ipfs upload authorisation could not reach the chain:', e.message);
    return { ok: false, error: 'authorisation_unavailable' };
  }
}

// A quota per WALLET as well as per IP: the IP arrives in a header and is spoofable, the wallet is
// proven by a signature.
const walletUploads = new Map();
const WALLET_UPLOAD_MAX = parseInt(process.env.IPFS_WALLET_LIMIT || '20', 10);
function walletQuotaOk(addr) {
  const now = Date.now();
  const key = String(addr).toLowerCase();
  const r = walletUploads.get(key);
  if (!r || now - r.t > RATE_LIMIT_WINDOW) { walletUploads.set(key, { c: 1, t: now }); return true; }
  if (r.c >= WALLET_UPLOAD_MAX) return false;
  r.c += 1; return true;
}

async function ipfsAdd(content, filename, contentType) {
  const fd = new FormData();
  fd.append('file', new Blob([content], { type: contentType }), filename);
  const r = await fetch(`${IPFS_API}/api/v0/add?pin=true`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`ipfs add ${r.status}`);
  const j = await r.json();
  return j.Hash;
}

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
  // т.4: ipfsRate was never swept — it grew with every distinct IP, for ever. So does a per-wallet
  // map, so both are cleaned here with the same window.
  for (const [k, v] of ipfsRate) if (now - v.t > RATE_LIMIT_WINDOW) ipfsRate.delete(k);
  for (const [k, v] of walletUploads) if (now - v.t > RATE_LIMIT_WINDOW) walletUploads.delete(k);
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

// The canonical message an uploader has to sign — published so the client cannot guess it wrong.
app.get('/api/ipfs/upload-message', (req, res) => {
  const { address, sha256 } = req.query || {};
  if (!ethers.isAddress(String(address || ''))) return res.status(400).json({ error: 'address_required' });
  if (!/^[0-9a-f]{64}$/.test(String(sha256 || ''))) return res.status(400).json({ error: 'sha256_required' });
  res.json({ message: uploadMessage(address, sha256) });
});

// Build ERC-721 metadata from student input: pin image -> build JSON -> pin JSON -> return ipfs:// CID.
//
// т.4 (2026-10-31): authenticated by a wallet signature + on-chain whitelist, type decided by the
// bytes, metadata stripped before pinning, quota per wallet as well as per IP.
app.post('/api/ipfs/metadata', ipfsJson, async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (!ipfsRateOk(ip)) return res.status(429).json({ error: 'too_many_requests' });
  try {
    const { name, description, image, attributes, signature, address } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 100) return res.status(400).json({ error: 'invalid_name' });
    if (description != null && (typeof description !== 'string' || description.length > 2000)) return res.status(400).json({ error: 'invalid_description' });
    if (typeof image !== 'string' || !image.startsWith('data:')) return res.status(400).json({ error: 'invalid_image' });
    const m = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'invalid_image_format' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'empty_image' });
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'image_too_large' });

    // Who are you? Checked before any work is done, and before anything touches the IPFS node.
    const sha256 = require('crypto').createHash('sha256').update(buf).digest('hex');
    const auth = await authorizeUpload(signature, address, sha256);
    if (!auth.ok) {
      const status = auth.error === 'authorisation_unavailable' ? 503
        : ['not_whitelisted'].includes(auth.error) ? 403 : 401;
      return res.status(status).json({ error: auth.error });
    }
    if (!walletQuotaOk(auth.address)) return res.status(429).json({ error: 'wallet_quota_exceeded' });

    // What is this file really? The declared MIME is ignored; the bytes decide. JPEG/PNG/WebP only —
    // GIF has no lossless stripper here and an SVG is a scriptable document, so both are refused.
    const cleaned = cleanImage(buf);
    if (!cleaned.ok) return res.status(400).json({ error: cleaned.reason, declaredMime: m[1] });
    const { mime, ext } = cleaned;
    const attrs = [];
    if (attributes != null) {
      if (!Array.isArray(attributes) || attributes.length > 20) return res.status(400).json({ error: 'invalid_attributes' });
      for (const a of attributes) {
        if (!a || typeof a.trait_type !== 'string' || a.trait_type.length < 1 || a.trait_type.length > 50) return res.status(400).json({ error: 'invalid_attribute' });
        const v = a.value;
        if (!(typeof v === 'string' || typeof v === 'number') || String(v).length > 200) return res.status(400).json({ error: 'invalid_attribute_value' });
        attrs.push({ trait_type: a.trait_type, value: v });
      }
    }
    // Pin the CLEAN copy, never the original.
    const imageCid = await ipfsAdd(cleaned.clean, `image.${ext}`, mime);
    if (cleaned.had.length) {
      console.log(`ipfs: stripped ${cleaned.had.join(', ')} from an upload by ${auth.address} (${cleaned.bytesBefore} -> ${cleaned.bytesAfter} bytes)`);
    }
    const metadata = { name: name.trim(), description: (description || '').trim(), image: `ipfs://${imageCid}`, attributes: attrs };
    const metadataCid = await ipfsAdd(Buffer.from(JSON.stringify(metadata, null, 2)), 'metadata.json', 'application/json');
    res.json({
      metadataUri: `ipfs://${metadataCid}`,
      metadataCid,
      imageCid,
      gateway: `${IPFS_GATEWAY}/${metadataCid}`,
      imageGateway: `${IPFS_GATEWAY}/${imageCid}`,
      metadata,
      stripped: cleaned.had,
    });
  } catch (err) {
    console.error('ipfs metadata upload failed:', err);
    res.status(500).json({ error: 'ipfs_upload_failed' });
  }
});

// ── Certificates (2026-10-31) ─────────────────────────────────────────────────────────────────────
// A whole feature in one folder: the exam, the grading, the PDF, the on-chain issuing and the public
// verification. It is mounted here and nowhere else, so moving it to its own subdomain is moving the
// folder and deleting these three lines. It gets its own express.json() with a tighter limit.
app.use('/api/certificates', require('./certificates/index.cjs').createRouter({
  verifyTurnstile,
  transporter,
  mailFrom: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
  log: (...a) => console.log(...a),
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`EduChain API listening on 127.0.0.1:${PORT}`);
});
