// EduChain — certificate administration: look one up, revoke it, reinstate it (2026-10-31).
//
// Rendered inside the existing AdminPanel, which is already behind PageGate requires="admin".
//
// Two things happen when a certificate is revoked, and they happen in this order on purpose:
//   1. the CHAIN is changed, signed by the OWNER'S OWN WALLET in this browser. The owner key is not
//      on the server and must never be: a server that can revoke is a server whose compromise
//      rewrites history.
//   2. the human reason is recorded off-chain, authenticated by a signature over a canonical
//      message. The server checks the signature against the contract's `owner()` AND checks that
//      the chain already shows the certificate revoked — so a note can never contradict the chain.
//
// The reason CODE goes on-chain (a small closed list); the free text stays in our audit log, because
// text written into a public chain can never be corrected or erased.
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CertificateIcon } from "../components/icons";
import { useWeb3 } from "../context/Web3Context";
import { certApi } from "./api";
import type { VerifyResult } from "./api";

const REASONS = [1, 2, 3, 4, 255];

export default function AdminCertificates() {
  const { t } = useTranslation();
  const { contracts, withSigner, isOwner } = useWeb3();
  const [serial, setSerial] = useState("");
  const [data, setData] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasonCode, setReasonCode] = useState(1);
  const [reasonText, setReasonText] = useState("");

  const serialNumber = (s: string) => {
    const m = s.trim().toUpperCase().match(/^EDU-\d{4}-(\d+)$/);
    return m ? parseInt(m[1], 10) : (/^\d+$/.test(s.trim()) ? parseInt(s.trim(), 10) : NaN);
  };

  const lookup = useCallback(async () => {
    setBusy(true); setData(null);
    try {
      setData(await certApi.verify(serial.trim().toUpperCase()));
    } catch {
      toast.error(t("admin.cert.notFound", "No such certificate"));
    } finally { setBusy(false); }
  }, [serial, t]);

  /** Revoke on-chain with the owner's wallet, then record the reason. */
  const revoke = useCallback(async () => {
    const id = serialNumber(serial);
    const reg = withSigner(contracts.certificateRegistry as never);
    if (!reg || !Number.isSafeInteger(id)) { toast.error(t("admin.cert.needChain", "Connect the owner wallet on GembaBlockchain.")); return; }
    setBusy(true);
    try {
      const tx = await (reg as unknown as { revoke: (a: number, b: number) => Promise<{ wait: () => Promise<unknown> }> }).revoke(id, reasonCode);
      toast.loading(t("admin.cert.revoking", "Revoking on-chain…"), { id: "cert-revoke" });
      await tx.wait();
      toast.success(t("admin.cert.revoked", "Revoked on-chain"), { id: "cert-revoke" });

      // the note — only after the chain says revoked
      const { message } = await fetch(
        `/api/certificates/admin/revoke-message?serial=${encodeURIComponent(serial)}&reasonCode=${reasonCode}&reasonText=${encodeURIComponent(reasonText)}`,
      ).then((r) => r.json());
      const signer = (reg as unknown as { runner: { signMessage: (m: string) => Promise<string> } }).runner;
      const signature = await signer.signMessage(message);
      const res = await fetch("/api/certificates/admin/revoke-note", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, reasonCode, reasonText, signature, action: "revoke" }),
      });
      if (res.ok) toast.success(t("admin.cert.noted", "Reason recorded in the audit log"));
      else toast.error(t("admin.cert.noteFailed", "The chain was updated but the reason was not recorded"));
      await lookup();
    } catch (e) {
      toast.dismiss("cert-revoke");
      toast.error((e as Error)?.message?.slice(0, 120) || t("admin.cert.failed", "Failed"));
    } finally { setBusy(false); }
  }, [serial, reasonCode, reasonText, contracts, withSigner, lookup, t]);

  const reinstate = useCallback(async () => {
    const id = serialNumber(serial);
    const reg = withSigner(contracts.certificateRegistry as never);
    if (!reg || !Number.isSafeInteger(id)) return;
    setBusy(true);
    try {
      const tx = await (reg as unknown as { reinstate: (a: number) => Promise<{ wait: () => Promise<unknown> }> }).reinstate(id);
      await tx.wait();
      toast.success(t("admin.cert.reinstated", "Reinstated"));
      const { message } = await fetch(
        `/api/certificates/admin/revoke-message?serial=${encodeURIComponent(serial)}&action=reinstate&reasonText=${encodeURIComponent(reasonText)}`,
      ).then((r) => r.json());
      const signer = (reg as unknown as { runner: { signMessage: (m: string) => Promise<string> } }).runner;
      const signature = await signer.signMessage(message);
      await fetch("/api/certificates/admin/revoke-note", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, reasonCode: 0, reasonText, signature, action: "reinstate" }),
      });
      await lookup();
    } catch (e) {
      toast.error((e as Error)?.message?.slice(0, 120) || "failed");
    } finally { setBusy(false); }
  }, [serial, reasonText, contracts, withSigner, lookup, t]);

  return (
    <section className="card mb-6">
      <h2 className="font-display text-lg mb-1 inline-flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <CertificateIcon size={20} /> {t("admin.cert.title", "Certificates")}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {t("admin.cert.intro", "Look up a certificate by its serial and revoke it with a reason. Revocation is signed by your own wallet — the server cannot revoke anything.")}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1">
          <span className="form-label">{t("verify.serial", "Certificate serial")}</span>
          <input className="form-input font-mono" value={serial} onChange={(e) => setSerial(e.target.value)}
            placeholder="EDU-2026-000001" maxLength={24} spellCheck={false} />
        </label>
        <button type="button" className="btn-outline inline-flex items-center justify-center gap-2" onClick={lookup} disabled={busy || !serial.trim()}>
          <MagnifyingGlassIcon className="h-4 w-4" /> {t("verify.check", "Verify")}
        </button>
      </div>

      {data && (
        <div className="mt-4 grid gap-3">
          <div className="flex items-start gap-3">
            {data.valid ? <CheckCircleIcon className="h-6 w-6 flex-none" style={{ color: "var(--color-accent-success)" }} />
                        : <XCircleIcon className="h-6 w-6 flex-none" style={{ color: "var(--color-accent-danger)" }} />}
            <div className="text-sm" style={{ color: "var(--text-primary)" }}>
              <p className="font-medium">{data.valid ? t("verify.valid", "Valid") : t("verify.revoked", "Revoked")}</p>
              <p style={{ color: "var(--text-secondary)" }}>
                {[data.holderName, data.position, data.organisation].filter(Boolean).join(" · ") || "—"}
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                {data.issuedDate} · {data.scorePct} % · {data.serial}
              </p>
              {data.reasonText && <p style={{ color: "var(--text-secondary)" }}>{t("verify.reason", "Reason")}: {data.reasonText}</p>}
            </div>
          </div>

          {isOwner && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="form-label">{t("admin.cert.reasonCode", "Reason")}</span>
                <select className="form-input" value={reasonCode} onChange={(e) => setReasonCode(Number(e.target.value))}>
                  {REASONS.map((c) => <option key={c} value={c}>{t(`verify.reason${c}`, String(c))}</option>)}
                </select>
              </label>
              <label>
                <span className="form-label">{t("admin.cert.reasonText", "Note for the audit log (off-chain)")}</span>
                <input className="form-input" value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={500} />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                {data.valid
                  ? <button type="button" className="btn-flat primary" onClick={revoke} disabled={busy}>{t("admin.cert.revoke", "Revoke")}</button>
                  : <button type="button" className="btn-outline" onClick={reinstate} disabled={busy}>{t("admin.cert.reinstate", "Reinstate")}</button>}
              </div>
              <p className="sm:col-span-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("admin.cert.privacyNote", "Do not put personal data in the note: the reason CODE goes on-chain, the text stays in our own audit log.")}
              </p>
            </div>
          )}
          {!isOwner && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("admin.cert.ownerOnly", "Only the contract owner can revoke a certificate.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
