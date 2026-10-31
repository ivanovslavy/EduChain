// EduChain certificates — the PDF.
//
// Rendered with pdfkit rather than by printing a web page through a headless browser: a certificate
// must look the same in five years, and a Chromium on the server is a moving target plus a process
// per download. pdfkit draws the page from code, so the output is deterministic.
//
// Fonts: DejaVu Sans (and its bold), which is on the server and has FULL Cyrillic and Latin
// coverage. The site's own display font (Outfit) is Latin-only and is loaded from Google Fonts, so
// using it here would either break Bulgarian names or add a network dependency to issuing a
// certificate. The PDF therefore matches EduChain's COLOURS and layout, not its webfont.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// EduChain's palette, from src/index.css @theme.
const INDIGO = "#4F46E5";
const CYAN = "#06B6D4";
const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

const STR = {
  bg: {
    title: "СЕРТИФИКАТ",
    subtitle: "за успешно завършен изпит",
    awardedTo: "Издаден на",
    course: "Курс",
    courseName: "Основи на блокчейн и Web3",
    score: "Резултат",
    date: "Дата",
    serial: "Номер",
    position: "Длъжност",
    organisation: "Организация",
    verifyHint: "Проверка на сертификата:",
    issuer: "EduChain · GEMBA IT (GEMBA EOOD, ЕИК 208656371), Варна, България",
    chainNote: "Записан в GembaBlockchain (тестова мрежа 821207) само като отпечатък на данните — без лични данни във веригата.",
    scanMe: "Сканирай за проверка",
  },
  en: {
    title: "CERTIFICATE",
    subtitle: "of successful completion",
    awardedTo: "Awarded to",
    course: "Course",
    courseName: "Blockchain and Web3 Foundations",
    score: "Score",
    date: "Date",
    serial: "Serial",
    position: "Position",
    organisation: "Organisation",
    verifyHint: "Verify this certificate:",
    issuer: "EduChain · GEMBA IT (GEMBA EOOD, UIC 208656371), Varna, Bulgaria",
    chainNote: "Recorded on GembaBlockchain (testnet 821207) as a hash of its contents only — no personal data on the chain.",
    scanMe: "Scan to verify",
  },
  es: {
    title: "CERTIFICADO",
    subtitle: "de finalización satisfactoria",
    awardedTo: "Otorgado a",
    course: "Curso",
    courseName: "Fundamentos de blockchain y Web3",
    score: "Resultado",
    date: "Fecha",
    serial: "Número",
    position: "Cargo",
    organisation: "Organización",
    verifyHint: "Verificar este certificado:",
    issuer: "EduChain · GEMBA IT (GEMBA EOOD, CIF 208656371), Varna, Bulgaria",
    chainNote: "Registrado en GembaBlockchain (red de pruebas 821207) solo como un hash de su contenido — sin datos personales en la cadena.",
    scanMe: "Escanear para verificar",
  },
};

function fontsPresent() {
  return fs.existsSync(FONT) && fs.existsSync(FONT_BOLD);
}

/**
 * Render one certificate.
 * @returns {Promise<{buffer: Buffer, sha256: string}>}
 */
async function render(cert) {
  if (!fontsPresent()) throw new Error(`certificate fonts are missing: ${FONT}`);
  const L = STR[cert.lang] || STR.en;
  const qrPng = await QRCode.toBuffer(cert.verifyUrl, { type: "png", width: 420, margin: 0, color: { dark: INK, light: "#FFFFFF" } });

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0, info: {
    Title: `${L.title} ${cert.serialText}`,
    Author: "EduChain · GEMBA IT",
    Subject: L.courseName,
    Keywords: `EduChain, ${cert.serialText}`,
    Creator: "EduChain certificate service",
  } });
  doc.registerFont("body", FONT);
  doc.registerFont("bold", FONT_BOLD);

  const W = doc.page.width;   // 841.89
  const H = doc.page.height;  // 595.28

  // ── frame: a thin indigo rule inside a wide white margin, plus a cyan accent bar at the top ──
  doc.rect(0, 0, W, 10).fill(INDIGO);
  doc.rect(0, 10, W, 4).fill(CYAN);
  doc.lineWidth(1).strokeColor(LINE).rect(36, 36, W - 72, H - 72).stroke();

  // ── header ───────────────────────────────────────────────────────────────────────────────────
  doc.font("bold").fontSize(11).fillColor(INDIGO)
     .text("EduChain", 64, 62, { characterSpacing: 2 });
  doc.font("body").fontSize(9).fillColor(MUTED)
     .text("educhain.gembait.com", 64, 78);

  doc.font("bold").fontSize(38).fillColor(INK)
     .text(L.title, 0, 120, { align: "center", characterSpacing: 4 });
  doc.font("body").fontSize(12).fillColor(MUTED)
     .text(L.subtitle, 0, 170, { align: "center" });

  // ── the name ─────────────────────────────────────────────────────────────────────────────────
  doc.font("body").fontSize(10).fillColor(MUTED)
     .text(L.awardedTo, 0, 208, { align: "center" });
  doc.font("bold").fontSize(26).fillColor(INDIGO)
     .text(cert.fullName, 64, 226, { align: "center", width: W - 128 });

  // a short rule under the name
  const nameRuleY = 268;
  doc.lineWidth(1).strokeColor(LINE).moveTo(W / 2 - 120, nameRuleY).lineTo(W / 2 + 120, nameRuleY).stroke();

  doc.font("body").fontSize(11).fillColor(INK)
     .text(`${cert.position} · ${cert.organisation}`, 64, nameRuleY + 12, { align: "center", width: W - 128 });

  // ── the course and the result ────────────────────────────────────────────────────────────────
  doc.font("body").fontSize(10).fillColor(MUTED).text(L.course, 0, 320, { align: "center" });
  doc.font("bold").fontSize(15).fillColor(INK).text(L.courseName, 64, 336, { align: "center", width: W - 128 });

  // ── the facts row ───────────────────────────────────────────────────────────────────────────
  const factsY = 400;
  const facts = [
    [L.score, `${cert.scorePct} %`],
    [L.date, cert.issuedDate],
    [L.serial, cert.serialText],
  ];
  const colW = (W - 300) / facts.length;
  facts.forEach(([label, value], i) => {
    const x = 90 + i * colW;
    doc.font("body").fontSize(9).fillColor(MUTED).text(label, x, factsY, { width: colW - 20 });
    doc.font("bold").fontSize(13).fillColor(INK).text(value, x, factsY + 14, { width: colW - 20 });
  });

  // ── the QR, bottom right ────────────────────────────────────────────────────────────────────
  const qrSize = 92;
  const qrX = W - 64 - qrSize;
  const qrY = H - 64 - qrSize - 14;
  doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });
  doc.font("body").fontSize(7).fillColor(MUTED)
     .text(L.scanMe, qrX - 10, qrY + qrSize + 4, { width: qrSize + 20, align: "center" });

  // ── footer ──────────────────────────────────────────────────────────────────────────────────
  const footY = H - 112;
  doc.font("body").fontSize(8).fillColor(MUTED)
     .text(`${L.verifyHint} ${cert.verifyUrl}`, 64, footY, { width: W - 190 });
  doc.font("body").fontSize(7).fillColor(MUTED)
     .text(L.chainNote, 64, footY + 14, { width: W - 190 });
  doc.font("body").fontSize(7).fillColor(MUTED)
     .text(L.issuer, 64, footY + 34, { width: W - 190 });
  doc.font("body").fontSize(6).fillColor(MUTED)
     .text(`hash ${cert.dataHash}`, 64, footY + 50, { width: W - 190 });

  doc.end();

  const chunks = [];
  await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", resolve);
    doc.on("error", reject);
  });
  const buffer = Buffer.concat(chunks);
  return { buffer, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
}

/** The printed serial: EDU-<year of issue>-<6 digits>. Parsed back by the verify endpoint. */
function serialText(serial, issuedDate) {
  const year = String(issuedDate).slice(0, 4);
  return `EDU-${year}-${String(serial).padStart(6, "0")}`;
}

/** EDU-2026-000123 -> 123. Returns null for anything that is not our format. */
function parseSerial(text) {
  const m = String(text || "").trim().toUpperCase().match(/^EDU-(\d{4})-(\d{1,9})$/);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return { serial: n, year: m[1] };
}

module.exports = { render, serialText, parseSerial, fontsPresent, STR };
