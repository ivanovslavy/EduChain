// EduChain certificates — the API (2026-10-31).
//
// Mounted at /api/certificates by server/index.cjs. Everything the feature needs lives in this
// folder, so moving it to its own subdomain later is "move the folder, change one mount line".
//
// ──────────────────────────────────────────────────────────────────────────────────────────────────
// THE RULES THIS FILE ENFORCES, AND WHY
//
// 1. The correct answers are server-side, full stop. A browser receives question text and four
//    option texts in a per-attempt order; the correct position is never sent, not even indirectly
//    (no "right/wrong" feedback per question, no answer key after a failure).
// 2. No going back and no changing an answer: an answer is accepted only for the CURRENT index, and
//    only once. The cursor only moves forward, and it moves in the database, not in the client.
// 3. The sitting expires. After that, answers are refused and the attempt can only be finished
//    (scored on what was answered) — it cannot be resumed days later.
// 4. The e-mail is confirmed BEFORE the exam starts, so a certificate can never be addressed to
//    somebody else's inbox.
// 5. Attempt limits are per e-mail AND per wallet, not per IP. The IP is behind Cloudflare and
//    `trust proxy` — an IP limit is a courtesy, not a control (and proxy-addr has had spoofing
//    advisories). The IP limit stays as a cheap first filter, but it is never the only one.
// 6. Grading, issuing and sending happen in one server-side step the client cannot influence.
const express = require("express");
const crypto = require("crypto");
const { ethers } = require("ethers");

const db = require("./db.cjs");
const questions = require("./questions.cjs");
const pdf = require("./pdf.cjs");
const chain = require("./chain.cjs");

const SITE = process.env.CERT_SITE_URL || "https://educhain.gembait.com";
const COURSE_ID = parseInt(process.env.CERT_COURSE_ID || "1", 10);
const EXAM_SECONDS = parseInt(process.env.CERT_EXAM_SECONDS || "1800", 10);
const MAX_ATTEMPTS_PER_DAY = parseInt(process.env.CERT_MAX_ATTEMPTS_PER_DAY || "3", 10);
const MAX_REGS_PER_DAY = parseInt(process.env.CERT_MAX_REGS_PER_DAY || "10", 10);
const MAX_CODE_TRIES = 5;
const LANGS = ["bg", "en", "es"];

// Revocation reason codes — the public, closed list. The chain stores the CODE; the free text stays
// in our audit log, because text in a public chain can never be corrected or erased.
const REASONS = { 1: "issued-in-error", 2: "exam-integrity", 3: "withdrawn-by-holder", 4: "data-correction", 255: "other" };

/**
 * @param {object} deps
 * @param {(token:string, ip:string)=>Promise<boolean>} deps.verifyTurnstile
 * @param {object} deps.transporter   nodemailer transport (shared with /api/contact)
 * @param {string} deps.mailFrom
 * @param {(...a)=>void} [deps.log]
 */
function createRouter(deps) {
  const log = deps.log || console.log;
  const router = express.Router();
  router.use(express.json({ limit: "32kb" }));
  db.init();

  // ── helpers ─────────────────────────────────────────────────────────────────────────────────
  const ipOf = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

  // A cheap per-IP filter in front of the real per-identity limits. Swept, unlike the one in the
  // contact endpoint, so it cannot grow without bound.
  const ipHits = new Map();
  const IP_WINDOW = 3600 * 1000;
  const IP_MAX = parseInt(process.env.CERT_IP_LIMIT || "40", 10);
  setInterval(() => {
    const cutoff = Date.now() - IP_WINDOW;
    for (const [k, v] of ipHits) if (v.t < cutoff) ipHits.delete(k);
  }, 10 * 60 * 1000).unref();
  function ipOk(ip) {
    const now = Date.now();
    const r = ipHits.get(ip);
    if (!r || now - r.t > IP_WINDOW) { ipHits.set(ip, { c: 1, t: now }); return true; }
    if (r.c >= IP_MAX) return false;
    r.c += 1; return true;
  }

  // Strip CONTROL characters (a newline in a name would reach a mail header), then trim and cap.
  const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;
  // Three names, letters only (Latin or Cyrillic), hyphens and apostrophes allowed.
  const NAME_RE = /^[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){2,3}$/u;

  const dateOf = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const bad = (res, code, extra) => res.status(400).json({ error: code, ...(extra || {}) });

  function currentQuestion(att) {
    if (att.cursor >= att.questions.length) return null;
    return questions.publicQuestion(att.questions[att.cursor], att.lang, att.cursor + 1, att.questions.length);
  }

  // ── POST /start ─────────────────────────────────────────────────────────────────────────────
  // Takes the form, checks it, and e-mails a code. No attempt and no questions yet.
  router.post("/start", async (req, res) => {
    const ip = ipOf(req);
    if (!ipOk(ip)) return res.status(429).json({ error: "too_many_requests" });

    const fullName = clean(req.body?.fullName, 120);
    const email = clean(req.body?.email, 200).toLowerCase();
    const position = clean(req.body?.position, 120);
    const organisation = clean(req.body?.organisation, 160);
    const lang = LANGS.includes(req.body?.lang) ? req.body.lang : "en";
    const wallet = req.body?.wallet && ethers.isAddress(req.body.wallet) ? String(req.body.wallet).toLowerCase() : null;

    if (!NAME_RE.test(fullName)) return bad(res, "invalid_name");
    if (!isEmail(email)) return bad(res, "invalid_email");
    if (position.length < 2) return bad(res, "invalid_position");
    if (organisation.length < 2) return bad(res, "invalid_organisation");

    // The anti-bot gate, the same one the contact form uses. Fail CLOSED: no token, no exam.
    const token = req.body?.turnstileToken;
    if (!token) return res.status(400).json({ error: "turnstile_required" });
    if (!(await deps.verifyTurnstile(token, ip))) return res.status(403).json({ error: "turnstile_failed" });

    const emailHash = db.hashEmail(email);
    if (db.registrationsInWindow(emailHash, 86400) >= MAX_REGS_PER_DAY) {
      return res.status(429).json({ error: "too_many_codes", retryAfterSeconds: 86400 });
    }
    const used = db.attemptsInWindow(emailHash, wallet, 86400);
    if (used >= MAX_ATTEMPTS_PER_DAY) {
      return res.status(429).json({ error: "attempt_limit", used, max: MAX_ATTEMPTS_PER_DAY, retryAfterSeconds: 86400 });
    }

    const { id, code } = db.createRegistration({ fullName, email, position, organisation, lang, wallet });
    try {
      await sendCode(deps, { email, fullName, code, lang });
    } catch (e) {
      log(`certificates: sending the code failed: ${e.message}`);
      return res.status(502).json({ error: "mail_failed" });
    }
    log(`certificates: code sent · reg ${id} · attempts used today ${used}/${MAX_ATTEMPTS_PER_DAY}`);
    res.json({ regId: id, emailSentTo: maskEmail(email), expiresInSeconds: 15 * 60, attemptsLeft: MAX_ATTEMPTS_PER_DAY - used });
  });

  // ── POST /verify-email ──────────────────────────────────────────────────────────────────────
  // The code proves the address. Only now is an exam composed.
  router.post("/verify-email", (req, res) => {
    const ip = ipOf(req);
    if (!ipOk(ip)) return res.status(429).json({ error: "too_many_requests" });

    const regId = clean(req.body?.regId, 64);
    const code = clean(req.body?.code, 8);
    if (!/^[0-9a-f]{32}$/.test(regId)) return bad(res, "invalid_registration");
    if (!/^\d{6}$/.test(code)) return bad(res, "invalid_code");

    const reg = db.getRegistration(regId);
    if (!reg) return bad(res, "invalid_registration");
    if (reg.consumed_at) return bad(res, "already_used");
    if (reg.expires_at < db.now()) return bad(res, "code_expired");
    if (reg.code_tries >= MAX_CODE_TRIES) return res.status(429).json({ error: "too_many_code_tries" });

    // Constant-time compare so the number of wrong guesses is the only signal.
    const want = Buffer.from(reg.code_hash);
    const got = Buffer.from(db.hashCode(regId, code));
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
      db.bumpCodeTries(regId);
      const left = Math.max(0, MAX_CODE_TRIES - (reg.code_tries + 1));
      return res.status(401).json({ error: "wrong_code", triesLeft: left });
    }

    const exam = questions.composeExam();
    const attemptId = db.createAttempt({
      fullName: reg.full_name, email: reg.email, position: reg.position, organisation: reg.organisation,
      lang: reg.lang, wallet: reg.wallet, courseId: COURSE_ID, questions: exam, durationSeconds: EXAM_SECONDS,
    });
    db.consumeRegistration(regId);
    const att = db.getAttempt(attemptId);
    log(`certificates: attempt ${attemptId} started · ${exam.length} questions · lang ${reg.lang}`);
    res.json({
      attemptId,
      total: exam.length,
      passPct: questions.passPct(),
      expiresAt: att.expires_at,
      question: currentQuestion(att),
    });
  });

  // ── GET /attempt/:id ────────────────────────────────────────────────────────────────────────
  // Resume after a refresh. Returns where the sitting is — never what the answers were.
  router.get("/attempt/:id", (req, res) => {
    const att = db.getAttempt(clean(req.params.id, 64));
    if (!att) return res.status(404).json({ error: "unknown_attempt" });
    res.json({
      attemptId: att.id,
      total: att.questions.length,
      answered: att.answers.length,
      passPct: questions.passPct(),
      expiresAt: att.expires_at,
      expired: att.expires_at < db.now(),
      submitted: Boolean(att.submitted_at),
      question: att.submitted_at ? null : currentQuestion(att),
    });
  });

  // ── POST /answer ────────────────────────────────────────────────────────────────────────────
  // One answer, for the current question, once. The reply carries the next question and nothing
  // about whether the previous one was right — that would leak the answer key one question at a time.
  router.post("/answer", (req, res) => {
    const att = db.getAttempt(clean(req.body?.attemptId, 64));
    if (!att) return res.status(404).json({ error: "unknown_attempt" });
    if (att.submitted_at) return bad(res, "already_submitted");
    if (att.expires_at < db.now()) return bad(res, "attempt_expired");

    const index = Number(req.body?.index);
    const pos = Number(req.body?.answer);
    if (!Number.isInteger(index) || index !== att.cursor + 1) return bad(res, "wrong_index", { expected: att.cursor + 1 });
    if (!Number.isInteger(pos) || pos < 1 || pos > 4) return bad(res, "invalid_answer");
    if (att.answers.some((a) => a.index === index)) return bad(res, "already_answered");

    const spec = att.questions[att.cursor];
    const correct = questions.isCorrect(spec, pos);
    att.answers.push({ index, pos, correct, at: db.now() });
    const cursor = att.cursor + 1;
    db.saveAnswer(att.id, att.answers, cursor);

    const next = cursor < att.questions.length
      ? questions.publicQuestion(att.questions[cursor], att.lang, cursor + 1, att.questions.length)
      : null;
    res.json({ answered: cursor, total: att.questions.length, question: next, done: next === null });
  });

  // ── POST /finish ────────────────────────────────────────────────────────────────────────────
  // Grade, and if it is a pass: hash, issue on-chain, render, send. One server-side step.
  router.post("/finish", async (req, res) => {
    const att = db.getAttempt(clean(req.body?.attemptId, 64));
    if (!att) return res.status(404).json({ error: "unknown_attempt" });

    if (att.submitted_at) {
      // Idempotent: a double click must not issue two certificates.
      const cert = att.serial ? db.getCertificate(att.serial) : null;
      return res.json(resultPayload(att, cert));
    }

    const answered = att.answers.length;
    const correct = att.answers.filter((a) => a.correct).length;
    const total = att.questions.length;
    const scorePct = Math.round((correct / total) * 100);
    const passed = scorePct >= questions.passPct();
    db.finishAttempt(att.id, scorePct, passed);
    log(`certificates: attempt ${att.id} finished · ${correct}/${total} = ${scorePct}% · ${passed ? "PASS" : "fail"} · answered ${answered}`);

    if (!passed) {
      const fresh = db.getAttempt(att.id);
      return res.json(resultPayload(fresh, null));
    }

    // ── the pass path ──────────────────────────────────────────────────────────────────────────
    const holder = att.wallet || null;
    if (!holder) {
      // The page is behind a connected wallet, so this should be unreachable. If it ever happens we
      // say so instead of inventing a holder.
      return res.status(409).json({ error: "no_wallet_on_attempt", scorePct, passed: true });
    }
    const issuedDate = dateOf(db.now());
    const hashInput = {
      fullName: att.full_name, position: att.position, organisation: att.organisation,
      courseId: att.course_id, scorePct, issuedDate, lang: att.lang, holder,
    };
    const dataHash = chain.dataHash(hashInput);

    let onChain;
    try {
      onChain = await chain.issue({ holder, hash: dataHash, courseId: att.course_id, scorePct });
    } catch (e) {
      log(`certificates: on-chain issue FAILED for attempt ${att.id}: ${e.shortMessage || e.message}`);
      // The attempt stays passed, so a retry can finish the job without a second exam.
      return res.status(502).json({ error: "chain_issue_failed", scorePct, passed: true, retryable: true });
    }

    const serialText = pdf.serialText(onChain.serial, issuedDate);
    const verifyUrl = `${SITE}/${att.lang}/verify/${serialText}`;
    let rendered;
    try {
      rendered = await pdf.render({
        fullName: att.full_name, position: att.position, organisation: att.organisation,
        lang: att.lang, scorePct, issuedDate, serialText, verifyUrl, dataHash,
      });
    } catch (e) {
      log(`certificates: PDF render failed for serial ${onChain.serial}: ${e.message}`);
      return res.status(500).json({ error: "pdf_failed", scorePct, passed: true, serial: serialText, verifyUrl });
    }

    db.createCertificate({
      serial: onChain.serial, attemptId: att.id, fullName: att.full_name, position: att.position,
      organisation: att.organisation, lang: att.lang, courseId: att.course_id, scorePct,
      issuedDate, holder, dataHash, chainTx: onChain.txHash, pdfSha256: rendered.sha256,
    });

    try {
      await sendCertificate(deps, {
        email: att.email, fullName: att.full_name, lang: att.lang, scorePct,
        serialText, verifyUrl, pdf: rendered.buffer,
      });
      db.markMailSent(onChain.serial);
      log(`certificates: serial ${serialText} issued (tx ${onChain.txHash}) and e-mailed`);
    } catch (e) {
      log(`certificates: serial ${serialText} issued but the e-mail failed: ${e.message}`);
    }

    const fresh = db.getAttempt(att.id);
    res.json(resultPayload(fresh, db.getCertificate(onChain.serial)));
  });

  function resultPayload(att, cert) {
    const correct = att.answers.filter((a) => a.correct).length;
    const out = {
      scorePct: att.score_pct,
      correct,
      total: att.questions.length,
      passPct: questions.passPct(),
      passed: Boolean(att.passed),
    };
    if (!att.passed) {
      // A failure never carries the answer key, and never says which questions were wrong.
      out.retryAfterSeconds = 86400;
      out.maxAttemptsPerDay = MAX_ATTEMPTS_PER_DAY;
      return out;
    }
    if (cert) {
      out.serial = pdf.serialText(cert.serial, cert.issued_date);
      out.verifyUrl = `${SITE}/${cert.lang}/verify/${out.serial}`;
      out.issuedDate = cert.issued_date;
      out.chainTx = cert.chain_tx;
      out.mailSent = Boolean(cert.mail_sent_at);
      out.explorer = `https://testnet.gembascan.io/tx/${cert.chain_tx}`;
    }
    return out;
  }

  // ── GET /verify/:serial ─────────────────────────────────────────────────────────────────────
  // Public. The minimum: valid or not, the name, the date, the course. Never the e-mail.
  router.get("/verify/:serial", async (req, res) => {
    const parsed = pdf.parseSerial(req.params.serial);
    if (!parsed) return res.status(400).json({ error: "invalid_serial" });

    const row = db.getCertificate(parsed.serial);
    const onChain = await chain.read(parsed.serial);

    if (!row && !onChain) return res.status(404).json({ valid: false, found: false, serial: String(req.params.serial).toUpperCase() });

    // The chain decides validity. If the chain cannot be reached we say so rather than guessing.
    const chainReachable = onChain !== null;
    const revoked = chainReachable ? onChain.revoked : null;
    const rev = revoked ? db.lastRevocation(parsed.serial) : null;

    const out = {
      serial: pdf.serialText(parsed.serial, row ? row.issued_date : `${parsed.year}-01-01`),
      found: true,
      valid: chainReachable ? !onChain.revoked : null,
      chainReachable,
      revoked,
      course: { id: row ? row.course_id : onChain?.courseId, name: courseName(row ? row.lang : "en") },
      issuedDate: row ? row.issued_date : (onChain ? dateOf(onChain.issuedAt) : null),
      scorePct: row ? row.score_pct : onChain?.scorePct ?? null,
      holderName: row && row.full_name ? row.full_name : null,  // '' after minimisation
      organisation: row && row.organisation ? row.organisation : null,
      position: row && row.position ? row.position : null,
      registry: chain.REGISTRY,
      chainId: chain.CHAIN_ID,
      explorer: `https://testnet.gembascan.io/token/${chain.REGISTRY}/instance/${parsed.serial}`,
    };
    if (revoked) {
      out.revokedAt = dateOf(onChain.revokedAt);
      out.reasonCode = onChain.reasonCode;
      out.reason = REASONS[onChain.reasonCode] || "other";
      if (rev?.reason_text) out.reasonText = rev.reason_text;
    }
    if (row?.minimised_at) out.minimised = true;
    res.json(out);
  });

  // ── GET /token/:tokenId ─────────────────────────────────────────────────────────────────────
  // ERC-721 metadata for wallets. It is the contract's baseURI target, so it must stay stable, and
  // it must not leak personal data: the name is NOT in here, only the serial and the course.
  router.get("/token/:tokenId", async (req, res) => {
    const id = Number(req.params.tokenId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_token" });
    const row = db.getCertificate(id);
    const onChain = await chain.read(id);
    if (!row && !onChain) return res.status(404).json({ error: "unknown_token" });
    const issuedDate = row ? row.issued_date : dateOf(onChain.issuedAt);
    const serialText = pdf.serialText(id, issuedDate);
    res.set("Cache-Control", "public, max-age=300");
    res.json({
      name: `EduChain Certificate ${serialText}`,
      description: "A soulbound certificate for the EduChain blockchain and Web3 foundations exam. "
        + "It cannot be transferred or sold. No personal data is stored on-chain — only a hash of the "
        + `certificate's contents. Verify at ${SITE}/en/verify/${serialText}`,
      external_url: `${SITE}/en/verify/${serialText}`,
      image: `${SITE}/certificates/badge.svg`,
      attributes: [
        { trait_type: "Serial", value: serialText },
        { trait_type: "Course", value: courseName("en") },
        { trait_type: "Score", value: (row ? row.score_pct : onChain?.scorePct) ?? 0, display_type: "number" },
        { trait_type: "Issued", value: issuedDate },
        { trait_type: "Status", value: onChain ? (onChain.revoked ? "revoked" : "valid") : "unknown" },
        { trait_type: "Soulbound", value: "yes" },
      ],
    });
  });

  // ── POST /admin/revoke-note ─────────────────────────────────────────────────────────────────
  // The revocation itself happens ON-CHAIN, signed by the owner's own wallet in the browser — the
  // owner key is deliberately NOT on this server. This endpoint only records the human reason, and
  // it accepts it only from the address the contract names as owner, proven by a signature, and only
  // after the chain already shows the certificate as revoked. So the note can never contradict the
  // chain, and a leak of this API cannot revoke anything.
  router.post("/admin/revoke-note", async (req, res) => {
    const serialRaw = clean(req.body?.serial, 32);
    const parsed = pdf.parseSerial(serialRaw) || (/^\d+$/.test(serialRaw) ? { serial: Number(serialRaw) } : null);
    if (!parsed) return bad(res, "invalid_serial");
    const reasonCode = Number(req.body?.reasonCode);
    const reasonText = clean(req.body?.reasonText, 500);
    const signature = clean(req.body?.signature, 300);
    const action = req.body?.action === "reinstate" ? "reinstate" : "revoke";
    if (!REASONS[reasonCode] && action === "revoke") return bad(res, "invalid_reason_code");
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return bad(res, "invalid_signature");

    const message = revokeMessage({ serial: parsed.serial, reasonCode, reasonText, action });
    let signer;
    try { signer = ethers.verifyMessage(message, signature); } catch { return bad(res, "invalid_signature"); }
    if (!(await chain.isOwner(signer))) return res.status(403).json({ error: "not_owner", signer });

    const onChain = await chain.read(parsed.serial);
    if (!onChain) return res.status(404).json({ error: "unknown_certificate" });
    if (action === "revoke" && !onChain.revoked) return res.status(409).json({ error: "not_revoked_on_chain" });
    if (action === "reinstate" && onChain.revoked) return res.status(409).json({ error: "still_revoked_on_chain" });

    db.logRevocation({ serial: parsed.serial, reasonCode: action === "revoke" ? reasonCode : 0, reasonText, actor: signer, action });
    log(`certificates: ${action} note recorded for serial ${parsed.serial} by ${signer}`);
    res.json({ ok: true, serial: parsed.serial, action, log: db.revocationLog(parsed.serial).length });
  });

  /** The exact text an admin signs. Pinned here and in the frontend; a mismatch means no signature. */
  function revokeMessage({ serial, reasonCode, reasonText, action }) {
    return [
      "EduChain certificate administration",
      `action: ${action}`,
      `serial: ${serial}`,
      `reasonCode: ${action === "revoke" ? reasonCode : 0}`,
      `reasonText: ${reasonText || ""}`,
    ].join("\n");
  }
  router.get("/admin/revoke-message", (req, res) => {
    const parsed = pdf.parseSerial(clean(req.query.serial, 32)) || (/^\d+$/.test(clean(req.query.serial, 32)) ? { serial: Number(req.query.serial) } : null);
    if (!parsed) return bad(res, "invalid_serial");
    res.json({ message: revokeMessage({
      serial: parsed.serial,
      reasonCode: Number(req.query.reasonCode) || 0,
      reasonText: clean(req.query.reasonText, 500),
      action: req.query.action === "reinstate" ? "reinstate" : "revoke",
    }) });
  });

  // ── GET /health ─────────────────────────────────────────────────────────────────────────────
  router.get("/health", async (req, res) => {
    res.json({
      ok: true,
      bank: { questions: questions.bankSize(), examSize: questions.examSize(), passPct: questions.passPct() },
      fonts: pdf.fontsPresent(),
      db: db.stats(),
      retention: { attemptDays: db.KEEP_ATTEMPT_DAYS, certificateDays: db.KEEP_CERT_DAYS },
      chain: await chain.health(),
    });
  });

  // ── POST /internal/retention ────────────────────────────────────────────────────────────────
  // Called by the daily cron over localhost; refused from anywhere else.
  router.post("/internal/retention", (req, res) => {
    const ip = ipOf(req);
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) return res.status(403).json({ error: "localhost_only", ip });
    const removed = db.runRetention();
    log(`certificates: retention ${JSON.stringify(removed)}`);
    res.json({ ok: true, removed });
  });

  function courseName(lang) {
    return (pdf.STR[lang] || pdf.STR.en).courseName;
  }

  return router;
}

// ── mail ──────────────────────────────────────────────────────────────────────────────────────────
// Through the transport the platform already uses for /api/contact. nodemailer sets Date and
// Message-ID itself and encodes a Cyrillic subject as a single encoded-word, which is exactly what
// the house rule on mail headers requires; mail-i18n tests assert both on the real message.

function maskEmail(e) {
  const [u, d] = String(e).split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

const MAIL = {
  bg: {
    codeSubject: "Код за достъп до изпита на EduChain",
    codeBody: (name, code) => `Здравей, ${name},\n\nКодът за започване на изпита е: ${code}\n\nВалиден е 15 минути и е за еднократна употреба. Ако не си заявявал изпит, просто изтрий това писмо.\n\nEduChain · educhain.gembait.com`,
    certSubject: (serial) => `Сертификат ${serial} от EduChain`,
    certBody: (name, score, serial, url) => `Здравей, ${name},\n\nИзпитът е преминат с резултат ${score} %. Сертификатът е прикачен към това писмо.\n\nНомер: ${serial}\nПроверка: ${url}\n\nСертификатът е записан и в GembaBlockchain (тестова мрежа) — само като отпечатък на данните, без лични данни във веригата. Той е непрехвърляем: остава завинаги на адреса, на който е издаден.\n\nEduChain · educhain.gembait.com`,
  },
  en: {
    codeSubject: "Your EduChain exam access code",
    codeBody: (name, code) => `Hello ${name},\n\nYour code to start the exam is: ${code}\n\nIt is valid for 15 minutes and can be used once. If you did not request an exam, simply delete this message.\n\nEduChain · educhain.gembait.com`,
    certSubject: (serial) => `EduChain certificate ${serial}`,
    certBody: (name, score, serial, url) => `Hello ${name},\n\nYou passed the exam with ${score} %. Your certificate is attached to this message.\n\nSerial: ${serial}\nVerify: ${url}\n\nThe certificate is also recorded on GembaBlockchain (testnet) as a hash of its contents only — no personal data on the chain. It is soulbound: it stays forever at the address it was issued to.\n\nEduChain · educhain.gembait.com`,
  },
  es: {
    codeSubject: "Tu código de acceso al examen de EduChain",
    codeBody: (name, code) => `Hola ${name}:\n\nTu código para iniciar el examen es: ${code}\n\nEs válido durante 15 minutos y de un solo uso. Si no has solicitado un examen, simplemente elimina este mensaje.\n\nEduChain · educhain.gembait.com`,
    certSubject: (serial) => `Certificado ${serial} de EduChain`,
    certBody: (name, score, serial, url) => `Hola ${name}:\n\nHas aprobado el examen con un ${score} %. Tu certificado está adjunto a este mensaje.\n\nNúmero: ${serial}\nVerificación: ${url}\n\nEl certificado también está registrado en GembaBlockchain (red de pruebas) únicamente como un hash de su contenido — sin datos personales en la cadena. Es intransferible: permanece para siempre en la dirección a la que fue emitido.\n\nEduChain · educhain.gembait.com`,
  },
};

async function sendCode(deps, { email, fullName, code, lang }) {
  const M = MAIL[lang] || MAIL.en;
  await deps.transporter.sendMail({
    from: deps.mailFrom,
    to: email,
    subject: M.codeSubject,
    text: M.codeBody(fullName, code),
  });
}

async function sendCertificate(deps, { email, fullName, lang, scorePct, serialText, verifyUrl, pdf: buffer }) {
  const M = MAIL[lang] || MAIL.en;
  await deps.transporter.sendMail({
    from: deps.mailFrom,
    to: email,
    subject: M.certSubject(serialText),
    text: M.certBody(fullName, scorePct, serialText, verifyUrl),
    attachments: [{ filename: `${serialText}.pdf`, content: buffer, contentType: "application/pdf" }],
  });
}

module.exports = { createRouter, REASONS, MAIL, maskEmail };
