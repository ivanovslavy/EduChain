// EduChain — the Certificates page: exam → certificate (2026-10-31).
//
// A module of its own (src/certificates/) so it can later be lifted onto its own subdomain: it owns
// its route, its API client and its i18n namespace, and it imports only shared, generic pieces
// (PageGate, the icon factory, the theme classes).
//
// Four states, one page: intro+form → e-mail code → the exam → the result. The exam advances like a
// slider, one question per screen, and the progress bar always says where you are. There is no
// "back" and no "change my answer" — not because the UI hides it, but because the server accepts an
// answer only for the current index and only once. The UI simply tells the truth about that.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  CheckCircleIcon, ExclamationTriangleIcon, ArrowRightIcon,
  EnvelopeIcon, ShieldCheckIcon, LinkIcon,
} from "@heroicons/react/24/outline";
import { CertificateIcon } from "../components/icons";
import PageGate from "../components/PageGate";
import { useWeb3 } from "../context/Web3Context";
import { useTheme } from "../context/ThemeContext";
import { certApi, CertApiError, rememberAttempt, forgetAttempt, rememberedAttempt } from "./api";
import type { Question, FinishResult } from "./api";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;
const EXAM_BANK_HINT = 65;

type Stage = "form" | "code" | "quiz" | "result";

const TOPIC_KEY: Record<string, string> = {
  basics: "certificates.topicBasics",
  wallets: "certificates.topicWallets",
  transactions: "certificates.topicTransactions",
  contracts: "certificates.topicContracts",
  security: "certificates.topicSecurity",
};

/** Map a server error code onto a translated sentence. Unknown codes fall back to one message. */
function useErrorText() {
  const { t } = useTranslation();
  return (e: unknown): string => {
    if (!(e instanceof CertApiError)) return t("certificates.errGeneric", "Something broke. Please try again.");
    const d = e.data as Record<string, number>;
    switch (e.code) {
      case "invalid_name": return t("certificates.errInvalidName", "Enter three names.");
      case "invalid_email": return t("certificates.errInvalidEmail", "Enter a valid e-mail address.");
      case "invalid_position": return t("certificates.errInvalidPosition", "Enter a position.");
      case "invalid_organisation": return t("certificates.errInvalidOrganisation", "Enter an organisation.");
      case "turnstile_required":
      case "turnstile_failed": return t("certificates.errTurnstile", "The anti-bot check did not pass.");
      case "attempt_limit": return t("certificates.errAttemptLimit", "Attempt limit reached.", { max: d.max ?? 3 });
      case "too_many_codes": return t("certificates.errTooManyCodes", "Too many codes requested.");
      case "too_many_requests": return t("certificates.errTooManyCodes", "Too many requests.");
      case "wrong_code": return t("certificates.errWrongCode", "Wrong code.")
        + (d.triesLeft != null ? ` ${t("certificates.codeTriesLeft", "{{n}} tries left", { n: d.triesLeft })}` : "");
      case "code_expired":
      case "already_used": return t("certificates.errCodeExpired", "The code has expired.");
      case "mail_failed": return t("certificates.errMail", "The e-mail could not be sent.");
      case "chain_issue_failed": return t("certificates.errChain", "The on-chain record did not go through.");
      case "attempt_expired": return t("certificates.expired", "Time ran out for this sitting.");
      default: return t("certificates.errGeneric", "Something broke. Please try again.");
    }
  };
}

function Progress({ index, total }: { index: number; total: number }) {
  const { t } = useTranslation();
  const done = index - 1;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2 text-sm">
        <span style={{ color: "var(--text-primary)" }} className="font-medium">
          {t("certificates.progress", "Question {{index}} of {{total}}", { index, total })}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          {t("certificates.progressDetail", "{{done}} done · {{left}} to go", { done, left: total - done })}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--bg-tertiary)" }}
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="h-full"
          style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))" }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  q, busy, onAnswer,
}: { q: Question; busy: boolean; onAnswer: (pos: number) => void }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { setPicked(null); }, [q.index]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="status-pill">{t(TOPIC_KEY[q.topic] || "certificates.topicBasics", q.topic)}</span>
        <span style={{ color: "var(--text-tertiary, var(--text-secondary))" }}>
          {t("certificates.level", "Level {{n}}", { n: q.level })}
        </span>
      </div>
      <h2 className="font-display text-xl md:text-2xl mb-5 leading-snug" style={{ color: "var(--text-primary)" }}>
        {q.text}
      </h2>
      <div className="grid gap-2.5">
        {q.options.map((o) => {
          const active = picked === o.pos;
          return (
            <button
              key={o.pos}
              type="button"
              disabled={busy}
              onClick={() => setPicked(o.pos)}
              className="card clickable text-left flex items-start gap-3 disabled:opacity-60"
              style={active ? { borderColor: "var(--color-primary)", background: "var(--bg-secondary)" } : undefined}
              aria-pressed={active}
            >
              <span
                className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  background: active ? "var(--color-primary)" : "var(--bg-tertiary)",
                  color: active ? "#fff" : "var(--text-secondary)",
                }}
              >
                {o.pos}
              </span>
              <span style={{ color: "var(--text-primary)" }}>{o.text}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("certificates.noBackWarning", "Once you pick an answer there is no going back.")}
      </p>
      <button
        type="button"
        className="btn-flat primary mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2"
        disabled={busy || picked === null}
        onClick={() => picked !== null && onAnswer(picked)}
      >
        {busy
          ? t("certificates.finishing", "Working…")
          : q.index === q.total
            ? t("certificates.finish", "Finish the exam")
            : t("certificates.next", "Answer and continue")}
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="form-label">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{hint}</span>}
    </label>
  );
}

function CertificatesInner() {
  const { t, i18n } = useTranslation();
  const { lang = "en" } = useParams();
  const { account } = useWeb3();
  const { dark } = useTheme();
  const errText = useErrorText();

  const [stage, setStage] = useState<Stage>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", position: "", organisation: "" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const [regId, setRegId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [code, setCode] = useState("");

  const [attemptId, setAttemptId] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [total, setTotal] = useState(20);
  const [passPct, setPassPct] = useState(80);
  const [expiresAt, setExpiresAt] = useState(0);
  const [result, setResult] = useState<FinishResult | null>(null);

  const onField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // A sitting that was interrupted (refresh, closed tab) is picked up where the SERVER says it was.
  useEffect(() => {
    const id = rememberedAttempt();
    if (!id) return;
    certApi.attempt(id).then((a) => {
      if (a.submitted || a.expired || !a.question) { forgetAttempt(); return; }
      setAttemptId(id); setQuestion(a.question); setTotal(a.total);
      setPassPct(a.passPct); setExpiresAt(a.expiresAt); setStage("quiz");
    }).catch(() => forgetAttempt());
  }, []);

  // The countdown, shown so nobody is surprised by an expiry.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (stage !== "quiz") return;
    const h = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(h);
  }, [stage]);
  const timeLeft = useMemo(() => {
    if (!expiresAt) return "";
    const s = Math.max(0, expiresAt - now);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, [expiresAt, now]);

  const submitForm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (TURNSTILE_KEY && !turnstileToken) { setError(t("certificates.errTurnstile", "The anti-bot check did not pass.")); return; }
    setBusy(true);
    try {
      const r = await certApi.start({
        ...form,
        lang: i18n.language || lang,
        wallet: account || null,
        turnstileToken,
      });
      setRegId(r.regId); setMaskedEmail(r.emailSentTo); setAttemptsLeft(r.attemptsLeft);
      setCode(""); setStage("code");
    } catch (err) {
      setError(errText(err));
      setTurnstileToken(""); turnstileRef.current?.reset();
    } finally { setBusy(false); }
  }, [form, turnstileToken, account, i18n.language, lang, t, errText]);

  const submitCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) { setError(t("certificates.errWrongCode", "Wrong code.")); return; }
    setBusy(true);
    try {
      const a = await certApi.verifyEmail({ regId, code: code.trim() });
      setAttemptId(a.attemptId); rememberAttempt(a.attemptId);
      setQuestion(a.question); setTotal(a.total); setPassPct(a.passPct); setExpiresAt(a.expiresAt);
      setStage("quiz");
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }, [code, regId, t, errText]);

  const finish = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const r = await certApi.finish(attemptId);
      setResult(r); setStage("result"); forgetAttempt();
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }, [attemptId, errText]);

  const answer = useCallback(async (pos: number) => {
    if (!question) return;
    setBusy(true); setError("");
    try {
      const r = await certApi.answer({ attemptId, index: question.index, answer: pos });
      if (r.done) { await finish(); return; }
      setQuestion(r.question);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }, [attemptId, question, finish, errText]);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <CertificateIcon size={28} /> {t("certificates.title", "Certificates")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("certificates.subtitle", "A 20-question exam.")}</p>
      </header>

      {error && (
        <div className="card mb-5 flex items-start gap-3" style={{ borderColor: "var(--color-accent-danger)" }}>
          <ExclamationTriangleIcon className="h-5 w-5 flex-none" style={{ color: "var(--color-accent-danger)" }} />
          <p style={{ color: "var(--text-primary)" }}>{error}</p>
        </div>
      )}

      {stage === "form" && (
        <div className="grid gap-5 lg:grid-cols-5 animate-fade-up">
          <section className="lg:col-span-3">
            <form onSubmit={submitForm} className="card grid gap-4">
              <div>
                <h2 className="font-display text-lg" style={{ color: "var(--text-primary)" }}>{t("certificates.formTitle", "Certificate details")}</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{t("certificates.formNote", "These details will be printed on the certificate.")}</p>
              </div>
              <Field label={t("certificates.fullName", "Full name")}>
                <input className="form-input" value={form.fullName} onChange={onField("fullName")} required maxLength={120}
                  placeholder={t("certificates.fullNamePlaceholder", "Ivan Petrov Ivanov")} autoComplete="name" />
              </Field>
              <Field label={t("certificates.email", "E-mail")}>
                <input className="form-input" type="email" value={form.email} onChange={onField("email")} required maxLength={200}
                  placeholder={t("certificates.emailPlaceholder", "ivan@example.com")} autoComplete="email" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("certificates.position", "Position")}>
                  <input className="form-input" value={form.position} onChange={onField("position")} required maxLength={120}
                    placeholder={t("certificates.positionPlaceholder", "Teacher")} />
                </Field>
                <Field label={t("certificates.organisation", "Organisation")}>
                  <input className="form-input" value={form.organisation} onChange={onField("organisation")} required maxLength={160}
                    placeholder={t("certificates.organisationPlaceholder", "School")} />
                </Field>
              </div>
              {account && (
                <p className="text-xs break-all" style={{ color: "var(--text-secondary)" }}>
                  {t("certificates.walletNote", "The certificate will be issued to: {{wallet}}", { wallet: account })}
                </p>
              )}
              {TURNSTILE_KEY && (
                <Turnstile
                  siteKey={TURNSTILE_KEY}
                  options={{ theme: dark ? "dark" : "light" }}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  ref={turnstileRef as never}
                />
              )}
              <button type="submit" className="btn-flat primary inline-flex items-center justify-center gap-2" disabled={busy}>
                <EnvelopeIcon className="h-4 w-4" />
                {busy ? t("certificates.starting", "Sending…") : t("certificates.start", "Send the code")}
              </button>
            </form>
          </section>

          <aside className="lg:col-span-2 grid gap-4 content-start">
            <div className="card">
              <h2 className="font-display text-lg mb-2" style={{ color: "var(--text-primary)" }}>{t("certificates.howTitle", "How it works")}</h2>
              <ol className="grid gap-2 text-sm list-decimal pl-5" style={{ color: "var(--text-secondary)" }}>
                <li>{t("certificates.how1", "Confirm your e-mail with a code.")}</li>
                <li>{t("certificates.how2", "Answer {{n}} questions, one per screen.", { n: total })}</li>
                <li>{t("certificates.how3", "At {{pass}} % the certificate arrives by e-mail.", { pass: passPct })}</li>
                <li>{t("certificates.how4", "The chain holds only a hash.")}</li>
              </ol>
            </div>
            <div className="card">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("certificates.intro", "Questions are drawn at random from a bank of {{bank}}.", { bank: EXAM_BANK_HINT })}
              </p>
            </div>
            <div className="card flex items-start gap-3">
              <ShieldCheckIcon className="h-5 w-5 flex-none" style={{ color: "var(--color-accent-success, var(--color-accent))" }} />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("certificates.privacyNote", "We store the minimum.")}</p>
            </div>
          </aside>
        </div>
      )}

      {stage === "code" && (
        <form onSubmit={submitCode} className="card max-w-lg grid gap-4 animate-fade-up">
          <div>
            <h2 className="font-display text-lg" style={{ color: "var(--text-primary)" }}>{t("certificates.codeTitle", "Confirm your e-mail")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {t("certificates.codeSent", "We have sent a code to {{email}}.", { email: maskedEmail })}
            </p>
            {attemptsLeft != null && (
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                {t("certificates.attemptsLeft", "{{n}} attempts left today", { n: attemptsLeft })}
              </p>
            )}
          </div>
          <Field label={t("certificates.code", "Code")}>
            <input className="form-input tracking-[0.4em] text-center text-lg" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              placeholder={t("certificates.codePlaceholder", "123456")} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-flat primary" disabled={busy || code.length !== 6}>
              {busy ? t("certificates.codeChecking", "Checking…") : t("certificates.codeSubmit", "Start the exam")}
            </button>
            <button type="button" className="btn-outline" onClick={() => { setStage("form"); setError(""); }}>
              {t("certificates.back", "Back")}
            </button>
          </div>
        </form>
      )}

      {stage === "quiz" && question && (
        <section className="max-w-2xl">
          <div className="flex items-center justify-between mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{t("certificates.quizTitle", "Exam")}</span>
            {timeLeft && <span>{t("certificates.timeLeft", "{{time}} left", { time: timeLeft })}</span>}
          </div>
          <Progress index={question.index} total={question.total} />
          {/* The slider: one question leaves to the left while the next arrives from the right.
              `mode="wait"` keeps exactly one card mounted, so a double tap cannot answer twice. */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={question.index}
                initial={{ opacity: 0, x: 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -48 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              >
                <QuestionCard q={question} busy={busy} onAnswer={answer} />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      )}

      {stage === "result" && result && (
        <section className="max-w-2xl grid gap-4 animate-fade-up">
          <div className="card flex items-start gap-3">
            {result.passed
              ? <CheckCircleIcon className="h-7 w-7 flex-none" style={{ color: "var(--color-accent-success, var(--color-accent))" }} />
              : <ExclamationTriangleIcon className="h-7 w-7 flex-none" style={{ color: "var(--color-accent-warning, var(--color-accent))" }} />}
            <div>
              <h2 className="font-display text-xl" style={{ color: "var(--text-primary)" }}>
                {result.passed ? t("certificates.resultPassTitle", "You passed") : t("certificates.resultFailTitle", "Not passed")}
              </h2>
              <p className="mt-1" style={{ color: "var(--text-primary)" }}>
                {t("certificates.score", "Score: {{score}} % ({{correct}} of {{total}})",
                  { score: result.scorePct, correct: result.correct, total: result.total })}
              </p>
              {!result.passed && (
                <>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {t("certificates.needed", "A certificate needs {{pass}} % or above.", { pass: result.passPct })}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {t("certificates.noAnswersShown", "We do not show the right answers.")}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {t("certificates.retry", "You can try again after 24 hours.", { max: result.maxAttemptsPerDay ?? 3 })}
                  </p>
                </>
              )}
            </div>
          </div>

          {result.passed && result.serial && (
            <div className="card grid gap-3">
              <div>
                <span className="form-label">{t("certificates.certSerial", "Certificate serial")}</span>
                <p className="font-mono text-lg" style={{ color: "var(--color-primary)" }}>{result.serial}</p>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {result.mailSent
                  ? t("certificates.certMailed", "The certificate has been e-mailed to you as a PDF.")
                  : t("certificates.certMailFailed", "The certificate was issued but the e-mail did not go out.")}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.verifyUrl && (
                  <a className="btn-flat primary inline-flex items-center gap-2" href={result.verifyUrl}>
                    <LinkIcon className="h-4 w-4" /> {t("certificates.openVerify", "Open the verification page")}
                  </a>
                )}
                {result.explorer && (
                  <a className="btn-outline inline-flex items-center gap-2" href={result.explorer} target="_blank" rel="noreferrer">
                    {t("certificates.certChain", "On-chain record")}
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function Certificates() {
  const { t } = useTranslation();
  return (
    // "connected" rather than "whitelisted": a certificate is for any learner who signs in with a
    // wallet, not only for the accounts on the course whitelist. Without a wallet PageGate renders
    // the project's own "connect to continue" notice, which is EduChain's sign-in.
    <PageGate requires="connected">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* A certificate is issued to an address, so the address has to exist before the exam does. */}
        <noscript>{t("certificates.needWallet", "Connect a wallet to start the exam.")}</noscript>
        <CertificatesInner />
      </div>
    </PageGate>
  );
}
