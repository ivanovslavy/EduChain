# Backup and restore

> Added 2026-11-01. Until 2026-10-31 EduChain had no backup job at all, while `README.md` and the
> About page claimed "automated nightly backups". The claim was removed, the job was built, and the
> claim was put back only once a restore had actually been performed.

## Why this file exists at all

`/var/lib/educhain/certificates.db` is **the only store of personal data on the platform**. It holds,
for every issued certificate, the holder's name, their position, their organisation, the issue date,
the score, and a salted hash of the e-mail address. The blockchain holds a keccak256 hash of the
printed contents and nothing else — deliberately, so that no personal data ever reaches a public
ledger.

The consequence is that this one file is not a cache. Lose it and every certificate already issued
becomes unverifiable in exactly the fields a human reads: `/{lang}/verify/{serial}` would still be
able to say "this serial exists on-chain and is not revoked", but it could no longer say *whose*
certificate it is. There is no second copy anywhere, and it cannot be reconstructed from the chain.

Everything else on the box is replaceable: the application code is on GitHub, the contracts are
on-chain and source-verified, the secrets are in the password safe, and the TLS key is reissued
rather than copied.

## The job

`/usr/local/bin/educhain-backup.sh`, run from root's crontab at **04:50 UTC** daily. 04:50 keeps it
clear of the other products' jobs (GembaPay 03:00, GembaTicket 03:30, GembaKitchen 04:10) and of the
failover jobs at 04:30/04:33. Logs to `/var/log/educhain-backup.log`, rotated weekly, 8 kept.

It produces three files per run, all named with the same UTC timestamp:

| file | what it is |
|---|---|
| `educhain-db-<TS>.sqlite.zst.age` | the certificate database |
| `educhain-state-<TS>.tar.zst.age` | what is needed to *run* the service again |
| `educhain-manifest-<TS>.json` | sizes, sha256 of each archive, exact row count per table, the recipient key, and the explicit list of what is deliberately absent |

The manifest is plaintext on purpose: it is what a restore is checked against, and it contains no
personal data — only table names and counts.

### The database copy is taken with `VACUUM INTO`, not `cp`

The database runs in WAL mode. In WAL mode a committed row may live only in the `-wal` file until a
checkpoint folds it into the main database, and `educhain-api` holds the file open permanently, so
there is no moment at which the main file alone is a complete database. **A byte-wise copy —
`cp`, `rsync`, `tar`, a filesystem snapshot of one file — is therefore not a backup.** This is not
theoretical; it is probe 1 of the test suite, and it loses the record every time.

The copy is made with SQLite's own `VACUUM INTO` over a read-only connection, through the same
`better-sqlite3` the service itself uses. SQLite writes a single new file with every committed WAL
frame already folded in, and touches nothing in the live database. The copy is then re-opened and
must answer `PRAGMA integrity_check` = `ok`, with all five expected tables present
(`attempts`, `certificates`, `meta`, `registrations`, `revocations`), before anything is compressed
or encrypted. A copy that has lost a table is not a backup of this service, and the job says so and
stops.

### Encryption: the server cannot read its own backups

Each archive is zstd-compressed and encrypted with [age](https://age-encryption.org) to the
**public** key in `/etc/educhain/backup.age.pub`. The matching **private** key exists only on the
owner's laptop, at `~/.educhain-backup-age/educhain-backup.key`, and was generated there — it has
never been on the server.

This is the point, not an inconvenience. The archives travel off-site and sit on a second machine;
anyone who compromises the EduChain host gets write access to a stream of ciphertext they cannot
read, and cannot retroactively read the backups of the personal data they would otherwise have had
to steal from the live database. `age -d` on the server fails with *"no identity matched any of the
recipients"*, and that is verified as part of the test suite.

### What is deliberately NOT in the backup

Do not "fix" any of these — they are the design:

- **No secret, in any form.** Not `.env`, not `.env.server`, not `blockchain/.env`. The state
  archive records the variable **names** only, as a checklist for a rebuild; the values come from
  Vaultwarden. age encryption is not a licence to put credentials in an archive that then leaves the
  building. The hot issuer key in particular may only call `issue()`, and the cold owner key is
  deliberately not on the server at all.
- **No TLS private key.** `/etc/ssl/gembait.com/key.pem` is reissued on a rebuild, never copied.
- **No exam question banks.** `server/certificates/questions/*.json` contain the **correct answers**.
  They are mode 640 root:www-data, excluded from git by name, and this job never reads them and never
  copies them anywhere more readable. Their master copy is kept off the server.
- **No application code.** It is on GitHub at `ivanovslavy/EduChain`.

After building the state archive the job asserts all of this again by tar **member name** — a match
for `.env`, `/questions/`, `*.key`, `key.pem`, `id_rsa` or `*.age` is a hard failure, not a warning.
Belt and braces, because the cost of getting it wrong is a credential in an off-site archive.

### Retention

| copy | window | where |
|---|---|---|
| local | **14 days** | `/var/backups/educhain`, mode 700, files 600, root-owned |
| off-site | **30 days** | a separate host, mode 700, reached over SSH with a dedicated key |

The off-site copy is **verified, not assumed**: after `rsync`, the job runs a `--checksum --dry-run`
comparison and then compares the sha256 of every archive on both sides. A mismatch, an empty result,
or an unreachable host is a failure. Remote retention failing is logged as a `WARN` and does not fail
the run, because an un-pruned off-site directory is a disk-space problem, not a data-loss one.

The off-site host and account are recorded in the operator notes, not here — this repository is
public, and naming the machine that holds the encrypted copies of the personal data adds nothing for
an operator and something for an attacker.

### Failure is loud

`set -Eeuo pipefail`, plus an `ERR` trap, so no step can fail silently. Steps are written as separate
statements, never `a && b`: a failure inside an `&&` list does **not** fire the `ERR` trap (found on
1 November 2026 — `mkdir -p "$OUT" && chmod 700 "$OUT"` let a run go on into a target that did not exist).
Any failure:

1. writes a `FAIL <reason>` line to `/var/log/educhain-backup.log`, where an operator sees it;
2. e-mails **`slavy@gembamail.com`** with the reason and the log path, through **our own relay**
   (`mail.gembamail.com:587`, STARTTLS required, certificate verified) as the service sender
   `contacts@gembait.com` — never through a personal mailbox;
3. exits **non-zero**.

Until 1 November 2026 the alert reused the APIs SMTP settings in , i.e. the owners
personal Gmail. It now reads its own `/etc/educhain/backup-alert.env` (600 root; `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — quoted, its `<>` would break sourcing) and sends
with `curl`; the credential reaches curl on stdin, never in `argv`, so it is not visible in `ps`.
It is best-effort: if the mail itself cannot be sent, that is logged as a `WARN … rc=N` and the
original failure is still reported. Proven on 1 November 2026: a forced failure (impossible target)
exited 1 and the relay delivered the mail (`status=sent … Saved`); a normal run sent nothing. The failure path is tested, not
assumed — see `blockchain/TESTING.md` §6b.

## Restoring

The private key is on the laptop, so a restore starts there.

```bash
# on the laptop
age -d -i ~/.educhain-backup-age/educhain-backup.key \
  educhain-db-<TS>.sqlite.zst.age | zstd -d > certificates.db

# sanity-check it BEFORE it goes anywhere near the live path
python3 -c "
import sqlite3
db = sqlite3.connect('file:certificates.db?mode=ro', uri=True)
print(db.execute('PRAGMA integrity_check').fetchone()[0])
for t in ('attempts','certificates','meta','registrations','revocations'):
    print(t, db.execute(f'SELECT COUNT(*) FROM \"{t}\"').fetchone()[0])"
```

Compare those counts against the `rows` object in the manifest of the same timestamp. Then, on the
server:

```bash
systemctl stop educhain-api
install -o www-data -g www-data -m 640 certificates.db /var/lib/educhain/certificates.db
# a stale -wal/-shm beside a restored file will be read in preference to it
rm -f /var/lib/educhain/certificates.db-wal /var/lib/educhain/certificates.db-shm
systemctl start educhain-api
```

`/var/lib/educhain` itself is 750 `www-data:www-data`.

Finally, check the thing that matters rather than the thing that is easy: take a certificate serial
out of the restored database and load `/{lang}/verify/{serial}`. The chain supplies validity, the
restored database supplies the name, the organisation and the date. If the readable fields come
back, the restore worked.

For a full rebuild from nothing, the state archive contains a generated `REBUILD.txt` with the
ordered procedure, the database schema, the systemd units, the Apache vhost, the deployed contract
addresses and the environment-variable **names** to re-fill from the password safe. It is regenerated
on every run, so it cannot drift from the machine.

## Tests

The job is not trusted because it exits 0; it is trusted because it has been restored and because
its failure path has been fired on purpose. Seven probes, including the byte-wise-copy probe that
demonstrates *why* `VACUUM INTO` is required and the missing-recipient-key probe that demonstrates
the alert actually leaves the building. Results and commands are in
[`../blockchain/TESTING.md`](../blockchain/TESTING.md) §6b; the scripts live on the laptop in
`EduChain-scripts/restore-test/` and leave nothing on the server.
