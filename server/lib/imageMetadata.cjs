// Strip the metadata out of an uploaded image BEFORE it is pinned to IPFS (т.4, 2026-10-31).
//
// Why on the server: IPFS is immutable and public. An image carries whatever the camera, phone or
// design tool left in it — GPS coordinates, a device serial, an author's e-mail — and once it is
// pinned under a CID that is permanent and world-readable. Doing it in the browser would be a
// courtesy; doing it here is the guarantee, because the browser is the part we do not control.
//
// The strip is LOSSLESS: only metadata segments are removed, the image data is untouched.
//   JPEG — APP1 (Exif, XMP), APP13 (Photoshop/IPTC), APP3…APP12, APP15, COM comments.
//          APP0 (JFIF) and APP2 (ICC colour profile) are KEPT: rendering information, not provenance.
//   PNG  — eXIf, tEXt, zTXt, iTXt (and the historical "Raw profile type exif" text chunks).
//   WebP — the EXIF and XMP chunks of the RIFF container, with the container size fixed up.
// Anything we cannot parse is REFUSED rather than pinned: there is no re-encoder here, and shipping
// an unknown container to a permanent public address is not a risk worth a convenience.
const MARKERS = [
  Buffer.from("Exif\0\0", "latin1"),
  Buffer.from("http://ns.adobe.com/xap/1.0/", "latin1"),
  Buffer.from("Photoshop 3.0", "latin1"),
  Buffer.from("eXIf", "latin1"),
  Buffer.from("iTXt", "latin1"),
  Buffer.from("tEXt", "latin1"),
  Buffer.from("zTXt", "latin1"),
];

/** An honest answer to "does this buffer still carry metadata?" — used by the tests and the audit. */
function findMetadata(buf) {
  const found = [];
  for (const m of MARKERS) if (buf.includes(m)) found.push(m.toString("latin1").replace(/\0/g, ""));
  return found;
}

/**
 * What is this file REALLY? Decided by its bytes, never by the Content-Type the client claimed.
 * A declared MIME is a request, not a fact: `image/png` on a file that is actually an SVG, or an
 * HTML page, is the oldest upload trick there is.
 */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "jpeg", mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "png", mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { kind: "webp", mime: "image/webp", ext: "webp" };
  // Everything else is refused on purpose, including GIF (no lossless stripper here) and SVG
  // (an SVG is a document that can carry script, served from our own gateway origin).
  return null;
}

const JPEG_DROP = new Set([0xe1, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xef, 0xfe]);

function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // scan: the rest is image
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    if (!JPEG_DROP.has(marker)) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(out);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);

function stripPng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return null;
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const end = i + 12 + len;
    if (end > buf.length) return null;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

function stripWebp(buf) {
  if (buf.subarray(0, 4).toString("latin1") !== "RIFF" || buf.subarray(8, 12).toString("latin1") !== "WEBP") return null;
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.subarray(i, i + 4).toString("latin1");
    const len = buf.readUInt32LE(i + 4);
    const padded = len + (len % 2);
    const end = i + 8 + padded;
    if (end > buf.length) break;
    if (type !== "EXIF" && type !== "XMP ") chunks.push(buf.subarray(i, end));
    i = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

/**
 * Sniff, then strip. Returns {ok, mime, ext, clean, had, left, bytesBefore, bytesAfter} — and
 * ok:false when the container is unknown or something survived the strip, so the caller can REFUSE
 * the upload rather than pin it.
 */
function cleanImage(buf) {
  const t = sniff(buf);
  if (!t) return { ok: false, reason: "unsupported_image_type" };
  const had = findMetadata(buf);
  const out = t.kind === "jpeg" ? stripJpeg(buf) : t.kind === "png" ? stripPng(buf) : stripWebp(buf);
  if (!out) return { ok: false, reason: "unparsable_image", mime: t.mime };
  const left = findMetadata(out);
  return {
    ok: left.length === 0,
    reason: left.length ? "metadata_not_removed" : null,
    mime: t.mime, ext: t.ext, clean: out, had, left,
    bytesBefore: buf.length, bytesAfter: out.length,
  };
}

module.exports = { cleanImage, findMetadata, sniff };
