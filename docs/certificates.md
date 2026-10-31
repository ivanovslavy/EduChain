# Certificates

> Added 2026-10-31. The exam, the certificate, the on-chain record and the public verification —
> what each part does, what is stored, and what deliberately is not.

EduChain issues a certificate for one thing: passing a 20-question exam on the foundations of
blockchain and Web3. The page is `/{lang}/certificates`, visible once a wallet is connected;
verification is `/{lang}/verify/<serial>` and is public.

---

## 1. The journey

1. **The form.** Three names, e-mail, position, organisation. These are the fields printed on the
   certificate, so they are the fields asked for — nothing else. Cloudflare Turnstile guards the
   form and fails closed: no token, no exam.
2. **The e-mail is confirmed first.** A six-digit code, valid 15 minutes, five guesses, stored only
   as an HMAC. No exam starts before the address is proven, so a certificate can never be addressed
   to somebody else's inbox.
3. **The exam.** 20 questions drawn at random from a bank of 65, spread 7/8/5 across three
   difficulty levels and covering all five topics (foundations · wallets and keys · transactions and
   fees · smart contracts · security). One question per screen. The four options are shuffled per
   attempt.
4. **No going back.** An answer is accepted only for the CURRENT question and only once — enforced
   by the server, which moves the cursor in the database, not by the interface hiding a button.
5. **The sitting expires** after 30 minutes. Three attempts per day, counted per e-mail AND per
   wallet (not per IP: an IP arrives in a header and can be forged, a wallet signature cannot).
6. **80 % or above** issues the certificate. Below that: the score, when you may try again, and
   nothing else — no list of wrong answers and no answer key, because the same bank is used for the
   next attempt.

---

## 2. Where the correct answers live

**On the server, and nowhere else.** The question banks (`server/certificates/questions/*.json`)
are server-side files; `publicQuestion()` builds the object a browser receives from scratch, with
the question text and four option texts in this attempt's order — no `correct`, no explanation, no
question id. The option *positions* mean nothing outside the attempt, because the shuffle is stored
per attempt in the database.

The result of an answer says only how many have been answered and what the next question is. It does
**not** say whether the previous one was right: that would hand out the answer key one question at a
time.

This is asserted, not assumed. `certificates-e2e.js` checks the exact key set of every payload, the
browser test scans every API response the page received during a full exam, and the build is grepped
for the bank's text and for `"correct"`. The canary suite breaks the guard on a copy and watches the
assertion go red.

---

## 3. What is stored, and for how long

| data | where | kept |
|---|---|---|
| three names, position, organisation | SQLite on the server, and on the PDF | 5 years, then dropped from the record |
| e-mail (plaintext) | SQLite | until the certificate has been sent, then deleted |
| e-mail (salted HMAC) | SQLite | for the attempt limit |
| the attempt: question ids, option order, answers, score | SQLite | 30 days if no certificate was issued, then deleted whole |
| serial, score, date | SQLite + chain | kept — a certificate that cannot be verified is not a certificate |
| **hash** of the certificate's contents | chain | permanent |
| revocation reason CODE | chain | permanent |
| revocation reason TEXT | SQLite audit log | kept |

**Nothing personal reaches the chain.** The on-chain record is `keccak256` over the printed contents,
plus the date, the score and the revocation flag. The hash proves that a certificate you are shown is
byte-for-byte the one that was issued, and reveals nothing. A name written into a public chain could
never be corrected, hidden or erased, and the GDPR right to erasure would be impossible to honour —
so it is not written.

Retention runs daily (`POST /api/certificates/internal/retention`, localhost only) and reports what
it removed.

---

## 4. The contract

`CertificateRegistry` — [`0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4`](https://testnet.gembascan.io/address/0x88f09c990E75958A84c4920a6AA03587Aa2DBdF4#code)
on GembaBlockchain testnet (821207), source-verified.

**Soulbound.** `transferFrom`, `safeTransferFrom`, `approve` and `setApprovalForAll` all revert. Not
even the contract owner can move a certificate. A diploma that can be sold certifies nothing.

**Two keys, separated on purpose.**

| role | key | may |
|---|---|---|
| `issuer` | HOT, on the server (`CERT_ISSUER_PRIVATE_KEY`) | `issue()` — and nothing else |
| `owner` | COLD, not on the server | appoint the issuer, revoke, reinstate, set the base URI |

If the server is compromised, the damage is bounded to certificates nobody earned — visible in the
event log and revocable by the owner. The server cannot revoke, cannot change roles and cannot
rewrite history.

**One hash, one serial.** `tokenOfHash` makes the same certificate impossible to issue twice.

**No external calls and no payable functions**, so there is no reentrancy surface at all: `_mint`
is used rather than `_safeMint` precisely so that minting cannot call out to a recipient contract.

Revocation reason codes: `1` issued in error · `2` exam integrity · `3` withdrawn at the holder's
request · `4` data correction · `255` other. The free text stays off-chain.

---

## 5. Verification

`GET /api/certificates/verify/<serial>` and the page at `/{lang}/verify/<serial>`.

**The chain decides.** Validity is read from `CertificateRegistry`, not from our database. When the
chain cannot be reached the page says so rather than showing a green tick from our own record.

The page shows the name, position, organisation, course, date, score, serial and the registry
address. It never shows an e-mail — the API does not even send one.

A QR on the PDF points straight at this page.

---

## 6. Administration

The owner revokes from the Admin panel, signing with **their own wallet in the browser**. The server
then records the human reason, authenticated by a signature over a canonical message, and only after
the chain already shows the certificate revoked — so the note can never contradict the chain, and a
compromise of the API cannot revoke anything.

Reinstatement exists and is owner-only: refusing to correct an administrative mistake is worse than
allowing the correction, and both events stay in the event log for ever, so nothing is hidden by it.

---

## 7. Tests

| suite | what it covers | result |
|---|---|---|
| `blockchain/test/10-certificates.test.js` | 39 unit/access/soulbound/invariant/privacy tests | 39/39 |
| `blockchain/test-forge/FuzzCertificateRegistry.t.sol` | 7 properties × 10 000 random runs | 7/7 |
| `certificates-e2e.js` | the full journey against the live DB, live chain, real PDF | 72/72 |
| `certificates-canaries.js` | 8 guards broken one at a time on a copy | 8/8 red |
| `certificates-browser.js` | the gate, the nav and the public verification in 3 languages | 37/37 |
| `certificates-mail-live.js` | the real SMTP path, with the real PDF, to a test address | 6/6 |
| Slither / Mythril | static analysis of the contract | 2 Low (by design), 0 issues |

The scripts live on the laptop in `~/Documents/Claude/EduChain-scripts/` — nothing of the kind is
left on the production server.
