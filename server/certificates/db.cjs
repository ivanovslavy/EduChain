// EduChain certificates — the only place in the platform that stores personal data (2026-10-31).
//
// ──────────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS AT ALL
//
// Until today EduChain had no database and collected nothing: that was a design decision and it is
// written into the privacy policy. A certificate cannot work that way — it has to carry the holder's
// name, and a verifier has to be able to check it years later. So this file is a deliberate, narrow
// exception, and it is built to collect the minimum and to forget on a schedule:
//
//   · the e-mail is kept only while it is needed (verify the address, send the PDF) and is then
//     replaced by a salted hash — enough to count attempts, useless for contacting anybody;
//   · an attempt that produced no certificate is deleted after 30 days, with everything in it;
//   · a certificate keeps the name, position, organisation and date for 5 years, because a
//     certificate that cannot be verified is not a certificate; after that it is reduced to the
//     serial, the score and the date;
//   · nothing here ever reaches the blockchain. The chain gets a hash. See CertificateRegistry.sol.
//
// SQLite rather than Postgres: one file, no new service, no new credentials, and a retention job
// that is a DELETE rather than an operations project. The whole dataset is a few thousand rows.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.CERT_DATA_DIR || "/var/lib/educhain";
const DB_PATH = path.join(DATA_DIR, "certificates.db");

// Retention, in days. Deliberately short for anything that is not a certificate.
const KEEP_ATTEMPT_DAYS = parseInt(process.env.CERT_KEEP_ATTEMPT_DAYS || "30", 10);
const KEEP_CERT_DAYS = parseInt(process.env.CERT_KEEP_CERT_DAYS || "1825", 10); // 5 years
const KEEP_CODE_MINUTES = 15;

let db = null;
let emailSalt = null;

function init() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  emailSalt = loadOrCreateSalt();
  return db;
}

const SCHEMA = `
-- A pending registration: somebody typed their details and we e-mailed them a code. No attempt
-- exists yet, so an abandoned registration costs us one row that the retention job removes.
CREATE TABLE IF NOT EXISTS registrations (
  id           TEXT PRIMARY KEY,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,          -- plaintext, deleted the moment the attempt is created
  email_hash   TEXT NOT NULL,          -- salted; survives for the per-address attempt limit
  position     TEXT NOT NULL,
  organisation TEXT NOT NULL,
  lang         TEXT NOT NULL,
  wallet       TEXT,
  code_hash    TEXT NOT NULL,          -- the 6-digit code, hashed; never stored in the clear
  code_tries   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  consumed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reg_email_hash ON registrations(email_hash);
CREATE INDEX IF NOT EXISTS idx_reg_created ON registrations(created_at);

-- One sitting of the exam. "questions" is the ordered list of question ids plus the per-question
-- option permutation, so the shuffle cannot be replayed differently and the correct answer never
-- has to travel to the browser.
CREATE TABLE IF NOT EXISTS attempts (
  id           TEXT PRIMARY KEY,
  full_name    TEXT NOT NULL,
  email        TEXT,                   -- NULL once the certificate has been sent
  email_hash   TEXT NOT NULL,
  position     TEXT NOT NULL,
  organisation TEXT NOT NULL,
  lang         TEXT NOT NULL,
  wallet       TEXT,
  course_id    INTEGER NOT NULL DEFAULT 1,
  questions    TEXT NOT NULL,          -- JSON: [{id, order:[keys]}]
  answers      TEXT NOT NULL DEFAULT '[]', -- JSON: [{index, key, correct, at}]
  cursor       INTEGER NOT NULL DEFAULT 0,
  started_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  submitted_at INTEGER,
  score_pct    INTEGER,
  passed       INTEGER,
  serial       INTEGER                  -- the certificate serial, when one was issued
);
CREATE INDEX IF NOT EXISTS idx_att_email_hash ON attempts(email_hash);
CREATE INDEX IF NOT EXISTS idx_att_started ON attempts(started_at);
CREATE INDEX IF NOT EXISTS idx_att_wallet ON attempts(wallet);

-- An issued certificate. The readable fields live here; the chain holds only data_hash.
CREATE TABLE IF NOT EXISTS certificates (
  serial       INTEGER PRIMARY KEY,
  attempt_id   TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  position     TEXT NOT NULL,
  organisation TEXT NOT NULL,
  lang         TEXT NOT NULL,
  course_id    INTEGER NOT NULL,
  score_pct    INTEGER NOT NULL,
  issued_at    INTEGER NOT NULL,
  issued_date  TEXT NOT NULL,          -- YYYY-MM-DD, the date printed on the PDF
  holder       TEXT NOT NULL,          -- the wallet address the soulbound token went to
  data_hash    TEXT NOT NULL UNIQUE,   -- keccak256 over the printed contents
  chain_tx     TEXT,
  pdf_sha256   TEXT,
  mail_sent_at INTEGER,
  minimised_at INTEGER                 -- set when the name/position/organisation were dropped
);
CREATE INDEX IF NOT EXISTS idx_cert_issued ON certificates(issued_at);

-- Revocations, as a log rather than a flag: the chain is authoritative for validity, this table
-- carries the human reason that must NOT be written into a public chain.
CREATE TABLE IF NOT EXISTS revocations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  serial       INTEGER NOT NULL,
  reason_code  INTEGER NOT NULL,
  reason_text  TEXT,
  actor        TEXT NOT NULL,          -- the admin wallet that signed
  action       TEXT NOT NULL,          -- 'revoke' | 'reinstate'
  at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rev_serial ON revocations(serial);

-- Small key/value store for the salt and bookkeeping.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`;

function loadOrCreateSalt() {
  const row = db.prepare("SELECT v FROM meta WHERE k = 'email_salt'").get();
  if (row) return row.v;
  const salt = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO meta (k, v) VALUES ('email_salt', ?)").run(salt);
  return salt;
}

/** A salted hash of an e-mail address: enough to count attempts, useless for reaching anybody. */
function hashEmail(email) {
  init();
  return crypto.createHmac("sha256", emailSalt).update(String(email).trim().toLowerCase()).digest("hex");
}

/** The code is stored hashed so a leak of the database does not hand out verification codes. */
function hashCode(regId, code) {
  init();
  return crypto.createHmac("sha256", emailSalt).update(`${regId}:${String(code).trim()}`).digest("hex");
}

const now = () => Math.floor(Date.now() / 1000);

// ── registrations ─────────────────────────────────────────────────────────────────────────────────

function createRegistration(r) {
  init();
  const id = crypto.randomBytes(16).toString("hex");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  db.prepare(`INSERT INTO registrations
      (id, full_name, email, email_hash, position, organisation, lang, wallet, code_hash, created_at, expires_at)
      VALUES (@id, @full_name, @email, @email_hash, @position, @organisation, @lang, @wallet, @code_hash, @created_at, @expires_at)`)
    .run({
      id,
      full_name: r.fullName,
      email: r.email,
      email_hash: hashEmail(r.email),
      position: r.position,
      organisation: r.organisation,
      lang: r.lang,
      wallet: r.wallet || null,
      code_hash: hashCode(id, code),
      created_at: now(),
      expires_at: now() + KEEP_CODE_MINUTES * 60,
    });
  return { id, code };
}

function getRegistration(id) {
  init();
  return db.prepare("SELECT * FROM registrations WHERE id = ?").get(id) || null;
}

function bumpCodeTries(id) {
  init();
  db.prepare("UPDATE registrations SET code_tries = code_tries + 1 WHERE id = ?").run(id);
}

function consumeRegistration(id) {
  init();
  // The plaintext e-mail moves to the attempt (it is still needed to send the PDF) and is removed
  // from the registration row in the same statement.
  db.prepare("UPDATE registrations SET consumed_at = ?, email = '' WHERE id = ?").run(now(), id);
}

// ── attempts ──────────────────────────────────────────────────────────────────────────────────────

function createAttempt(a) {
  init();
  const id = crypto.randomBytes(16).toString("hex");
  db.prepare(`INSERT INTO attempts
      (id, full_name, email, email_hash, position, organisation, lang, wallet, course_id, questions, started_at, expires_at)
      VALUES (@id, @full_name, @email, @email_hash, @position, @organisation, @lang, @wallet, @course_id, @questions, @started_at, @expires_at)`)
    .run({
      id,
      full_name: a.fullName,
      email: a.email,
      email_hash: hashEmail(a.email),
      position: a.position,
      organisation: a.organisation,
      lang: a.lang,
      wallet: a.wallet || null,
      course_id: a.courseId || 1,
      questions: JSON.stringify(a.questions),
      started_at: now(),
      expires_at: now() + (a.durationSeconds || 1800),
    });
  return id;
}

function getAttempt(id) {
  init();
  const row = db.prepare("SELECT * FROM attempts WHERE id = ?").get(id);
  if (!row) return null;
  row.questions = JSON.parse(row.questions);
  row.answers = JSON.parse(row.answers);
  return row;
}

function saveAnswer(id, answers, cursor) {
  init();
  db.prepare("UPDATE attempts SET answers = ?, cursor = ? WHERE id = ?").run(JSON.stringify(answers), cursor, id);
}

function finishAttempt(id, scorePct, passed) {
  init();
  db.prepare("UPDATE attempts SET submitted_at = ?, score_pct = ?, passed = ? WHERE id = ?")
    .run(now(), scorePct, passed ? 1 : 0, id);
}

/** How many sittings this e-mail (and, if given, this wallet) started in the last `windowSec`. */
function attemptsInWindow(emailHash, wallet, windowSec) {
  init();
  const since = now() - windowSec;
  const byEmail = db.prepare("SELECT COUNT(*) n FROM attempts WHERE email_hash = ? AND started_at >= ?").get(emailHash, since).n;
  const byWallet = wallet
    ? db.prepare("SELECT COUNT(*) n FROM attempts WHERE wallet = ? AND started_at >= ?").get(String(wallet).toLowerCase(), since).n
    : 0;
  return Math.max(byEmail, byWallet);
}

function registrationsInWindow(emailHash, windowSec) {
  init();
  return db.prepare("SELECT COUNT(*) n FROM registrations WHERE email_hash = ? AND created_at >= ?")
    .get(emailHash, now() - windowSec).n;
}

// ── certificates ──────────────────────────────────────────────────────────────────────────────────

function createCertificate(c) {
  init();
  db.prepare(`INSERT INTO certificates
      (serial, attempt_id, full_name, position, organisation, lang, course_id, score_pct, issued_at, issued_date, holder, data_hash, chain_tx, pdf_sha256)
      VALUES (@serial, @attempt_id, @full_name, @position, @organisation, @lang, @course_id, @score_pct, @issued_at, @issued_date, @holder, @data_hash, @chain_tx, @pdf_sha256)`)
    .run({
      serial: c.serial,
      attempt_id: c.attemptId,
      full_name: c.fullName,
      position: c.position,
      organisation: c.organisation,
      lang: c.lang,
      course_id: c.courseId,
      score_pct: c.scorePct,
      issued_at: now(),
      issued_date: c.issuedDate,
      holder: c.holder,
      data_hash: c.dataHash,
      chain_tx: c.chainTx || null,
      pdf_sha256: c.pdfSha256 || null,
    });
  db.prepare("UPDATE attempts SET serial = ? WHERE id = ?").run(c.serial, c.attemptId);
}

function getCertificate(serial) {
  init();
  return db.prepare("SELECT * FROM certificates WHERE serial = ?").get(serial) || null;
}

function markMailSent(serial) {
  init();
  // The address has done its job. From here on only the salted hash remains, on the attempt row.
  db.prepare("UPDATE certificates SET mail_sent_at = ? WHERE serial = ?").run(now(), serial);
  db.prepare("UPDATE attempts SET email = NULL WHERE serial = ?").run(serial);
}

function logRevocation(r) {
  init();
  db.prepare("INSERT INTO revocations (serial, reason_code, reason_text, actor, action, at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(r.serial, r.reasonCode, r.reasonText || null, r.actor, r.action, now());
}

function lastRevocation(serial) {
  init();
  return db.prepare("SELECT * FROM revocations WHERE serial = ? ORDER BY id DESC LIMIT 1").get(serial) || null;
}

function revocationLog(serial) {
  init();
  return db.prepare("SELECT * FROM revocations WHERE serial = ? ORDER BY id ASC").all(serial);
}

// ── retention ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Forget on schedule. Safe to run as often as you like; returns what it removed so the caller can
 * log real numbers rather than "done".
 */
function runRetention() {
  init();
  const t = now();
  const out = {};
  out.codes = db.prepare("DELETE FROM registrations WHERE consumed_at IS NULL AND expires_at < ?").run(t - 3600).changes;
  out.registrations = db.prepare("DELETE FROM registrations WHERE created_at < ?").run(t - KEEP_ATTEMPT_DAYS * 86400).changes;
  // An attempt that produced no certificate is deleted whole.
  out.attempts = db.prepare("DELETE FROM attempts WHERE serial IS NULL AND started_at < ?").run(t - KEEP_ATTEMPT_DAYS * 86400).changes;
  // An attempt that DID produce a certificate keeps only the link; its personal copy goes.
  out.attemptsMinimised = db.prepare(`UPDATE attempts SET email = NULL, full_name = '', position = '', organisation = ''
      WHERE serial IS NOT NULL AND started_at < ? AND full_name <> ''`).run(t - KEEP_ATTEMPT_DAYS * 86400).changes;
  // After five years a certificate keeps its serial, score and date — enough to answer "was this
  // ever issued" — and loses the name.
  out.certsMinimised = db.prepare(`UPDATE certificates SET full_name = '', position = '', organisation = '', minimised_at = ?
      WHERE issued_at < ? AND minimised_at IS NULL`).run(t, t - KEEP_CERT_DAYS * 86400).changes;
  return out;
}

function stats() {
  init();
  return {
    registrations: db.prepare("SELECT COUNT(*) n FROM registrations").get().n,
    attempts: db.prepare("SELECT COUNT(*) n FROM attempts").get().n,
    certificates: db.prepare("SELECT COUNT(*) n FROM certificates").get().n,
    revocations: db.prepare("SELECT COUNT(*) n FROM revocations").get().n,
  };
}

module.exports = {
  init, hashEmail, hashCode, now,
  createRegistration, getRegistration, bumpCodeTries, consumeRegistration, registrationsInWindow,
  createAttempt, getAttempt, saveAnswer, finishAttempt, attemptsInWindow,
  createCertificate, getCertificate, markMailSent,
  logRevocation, lastRevocation, revocationLog,
  runRetention, stats,
  DB_PATH, KEEP_ATTEMPT_DAYS, KEEP_CERT_DAYS,
};
