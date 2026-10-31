// EduChain — public certificate verification (2026-10-31).
//
// This page is the point of the whole feature: anybody holding a certificate can be checked by
// anybody, without asking us and without an account. It is therefore PUBLIC — no wallet, no gate.
//
// Two rules it keeps:
//   · it shows the minimum — name, date, course, score, serial. Never the e-mail. The API does not
//     even send one.
//   · the CHAIN decides validity. When the chain cannot be reached the page says so rather than
//     showing a green tick from our own database.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon,
  ExclamationTriangleIcon, MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { CertificateIcon } from "../components/icons";
import { certApi, CertApiError } from "./api";
import type { VerifyResult } from "./api";

const EXPLORER = (import.meta.env.VITE_ETHERSCAN_URL as string) || "https://testnet.gembascan.io";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2 border-t" style={{ borderColor: "var(--border-color)" }}>
      <span className="text-xs sm:w-44 sm:flex-none" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className={mono ? "font-mono break-all" : "break-words"} style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export default function Verify() {
  const { t } = useTranslation();
  const { lang = "en", serial: serialParam } = useParams();
  const navigate = useNavigate();
  const [serial, setSerial] = useState(serialParam || "");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [invalidSerial, setInvalidSerial] = useState(false);
  const [data, setData] = useState<VerifyResult | null>(null);

  const lookup = useCallback(async (s: string) => {
    const v = s.trim().toUpperCase();
    if (!v) return;
    setBusy(true); setNotFound(false); setInvalidSerial(false); setData(null);
    try {
      setData(await certApi.verify(v));
    } catch (e) {
      if (e instanceof CertApiError && e.status === 404) setNotFound(true);
      else if (e instanceof CertApiError && e.code === "invalid_serial") setInvalidSerial(true);
      else setNotFound(true);
    } finally { setBusy(false); }
  }, []);

  // A QR from a PDF lands here with the serial in the URL: verify immediately, no clicking.
  useEffect(() => { if (serialParam) lookup(serialParam); }, [serialParam, lookup]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = serial.trim().toUpperCase();
    if (v && v !== serialParam) navigate(`/${lang}/verify/${encodeURIComponent(v)}`);
    else lookup(v);
  };

  const reasonKey = data?.reasonCode ? `verify.reason${data.reasonCode}` : "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold mb-1 inline-flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <CertificateIcon size={28} /> {t("verify.title", "Verify a certificate")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("verify.subtitle", "Enter the serial from the certificate.")}</p>
      </header>

      <form onSubmit={submit} className="card mb-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1">
          <span className="form-label">{t("verify.serial", "Certificate serial")}</span>
          <input
            className="form-input font-mono"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder={t("verify.serialPlaceholder", "EDU-2026-000001")}
            maxLength={24}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn-flat primary inline-flex items-center justify-center gap-2" disabled={busy || !serial.trim()}>
          <MagnifyingGlassIcon className="h-4 w-4" />
          {busy ? t("verify.checking", "Checking…") : t("verify.check", "Verify")}
        </button>
      </form>

      {(notFound || invalidSerial) && (
        <div className="card flex items-start gap-3 animate-fade-up">
          <QuestionMarkCircleIcon className="h-7 w-7 flex-none" style={{ color: "var(--text-secondary)" }} />
          <div>
            <h2 className="font-display text-lg" style={{ color: "var(--text-primary)" }}>{t("verify.notFound", "No such certificate")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{t("verify.notFoundHint", "Check the serial.")}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid gap-4 animate-fade-up">
          <div className="card flex items-start gap-3">
            {data.valid === true && <CheckCircleIcon className="h-8 w-8 flex-none" style={{ color: "var(--color-accent-success, var(--color-accent))" }} />}
            {data.valid === false && <XCircleIcon className="h-8 w-8 flex-none" style={{ color: "var(--color-accent-danger)" }} />}
            {data.valid === null && <ExclamationTriangleIcon className="h-8 w-8 flex-none" style={{ color: "var(--color-accent-warning, var(--color-accent))" }} />}
            <div>
              <h2 className="font-display text-xl" style={{ color: "var(--text-primary)" }}>
                {data.valid === true && t("verify.valid", "Valid certificate")}
                {data.valid === false && t("verify.revoked", "Revoked certificate")}
                {data.valid === null && t("verify.unreachable", "The chain is not answering right now.")}
              </h2>
              {data.valid === false && data.revokedAt && (
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t("verify.revokedAt", "Revoked on")}: {data.revokedAt}
                  {reasonKey ? ` · ${t("verify.reason", "Reason")}: ${t(reasonKey, data.reason || "other")}` : ""}
                </p>
              )}
              {data.valid === false && data.reasonText && (
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{data.reasonText}</p>
              )}
            </div>
          </div>

          <div className="card">
            {data.holderName && <Row label={t("verify.holder", "Awarded to")} value={data.holderName} />}
            {data.position && data.organisation && <Row label={t("certificates.position", "Position")} value={`${data.position} · ${data.organisation}`} />}
            <Row label={t("verify.course", "Course")} value={data.course?.name || "—"} />
            {data.issuedDate && <Row label={t("verify.issued", "Date of issue")} value={data.issuedDate} />}
            {data.scorePct != null && <Row label={t("verify.score", "Score")} value={`${data.scorePct} %`} />}
            <Row label={t("verify.serialLabel", "Serial")} value={data.serial} mono />
            <Row label={t("verify.registry", "Registry contract")} value={data.registry} mono />
            {data.minimised && (
              <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>{t("verify.minimised", "The names have been removed under the retention period.")}</p>
            )}
            <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>{t("verify.noEmailNote", "This page never shows an e-mail address.")}</p>
          </div>

          <a className="btn-outline inline-flex w-full sm:w-auto items-center justify-center gap-2"
             href={data.explorer || `${EXPLORER}/address/${data.registry}`} target="_blank" rel="noreferrer">
            {t("verify.onChain", "View on the chain")}
          </a>
        </div>
      )}
    </div>
  );
}
