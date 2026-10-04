---
title: Privacy, Safety & Secrets — the Floor Every Module Stands On
category: foundation
system: cross-cutting
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, analysis-access-revocations, access-export-api-users, monitoring-1password]
---
# Privacy, Safety & Secrets — the Floor Every Module Stands On

## Why this matters

A control-plane concentrates read access to every system a security team oversees, plus a local database full of real identities and findings about real people. That makes it the most sensitive application on the operator's machine. Its safety model is not optional hardening to add later; it is what makes the tool permissible to run at all. Every rule here protects one of three things: the **credentials** the tool holds, the **people** whose activity it records, and the **estate** it must never be able to change.

## Design principles

| Principle | Rule | Because |
|---|---|---|
| **Secrets are references, not values** | Store 1Password secret references on disk; resolve into the process environment at launch. | A plaintext `.env` in a folder that syncs to a cloud drive is a credential leak with a timestamp. |
| **Read-only, audit-scoped** | Every vendor credential is read-only; cloud roles are audit-scoped (a `SecurityAudit`-class policy, not `ReadOnlyAccess`). | The oversight tool must not be a path to modify the estate, and read-only-everything still over-grants data access. |
| **Never pull a secret column** | When a source is a spreadsheet or register with secret columns, request only the non-secret ranges. | A secret you never fetched cannot leak from your database, export, or model packet. |
| **Blur, never hide** | Sensitive cohorts render blurred by default with an explicit reveal. Presence stays visible. | Hide means the operator may miss it; blur says "something is here, unblur to see it". |
| **Never quote sensitive content** | In chat, reports shared live, or summaries: reference a sensitive item by time or count, never by title or content. | Screen-share and transcript leakage happen through quotation, not through the UI. |
| **HR/legal before action on a person** | Findings about an individual are leads. Involve HR and legal before any step that touches that person. | The tool shows *how* work was done, never *why*. Automation is usually legitimate. |
| **Local-only dismissals when the vendor cannot be written** | Record the operator's disposition locally; label it local-only in every report. | No write-back must never be mistaken for vendor state having changed. |
| **Localhost-only, DNS-rebinding-safe** | Bind to loopback; refuse any request whose Host is not local; same-origin for mutations and side-effect GETs. | A browser on the same machine can be pointed at `127.0.0.1` by any web page. |

## Secrets handling

**Preferred: 1Password `op run`.** A `.env.op` file holds `VAR=op://<vault>/<item>/<field>` references and literal non-secrets (`API_ENDPOINT=https://…`). Launch with `op run --env-file=.env.op -- <server command>`. The references resolve into the process environment and nothing is written. Keep an `.env.op.example` with placeholder references so a new machine can be set up without seeing anyone's vault layout. Provide a `check` script that resolves each reference and prints ✓/✗ **without printing values**, and gates on `op whoami` with a friendly "sign in first" message.

Rules learned in practice:
- `op run` resolves a value only when it is *entirely* an `op://` reference. A database password cannot be embedded in a connection URL; give it its own variable.
- Pin the 1Password account explicitly on the command line (`--account`). Setting it inside the env file has no effect.
- Vaults accumulate duplicates and stale copies across accounts. Verify an item by comparing a hash of its value against the working value before trusting it; never print either.
- Keep a plaintext `.env.local` only as a documented fallback for quick starts, gitignored, and never in a synced folder. Timestamped backups of it are still plaintext — treat them the same.
- Cloud credentials: prefer SSO login per named profile over static keys in any env file. Re-read the credential files per run so re-authentication needs no restart.
- Token-mint schemes (API key → short-lived bearer): mint per run, do not cache. Decode the minted token once to confirm the tenant/org id the operator typed.

**Scoping the credentials.** Create a dedicated read-only API token or client per vendor, named for the control-plane so its use is attributable in the vendor's own audit log. For cloud accounts, assume an audit-scoped role, not a general read-only one — the difference is the ability to read data-plane contents (object bodies, secret values, message payloads) that oversight never needs. The control-plane reads secret *metadata* (rotation age, consumers) and never calls get-secret-value.

**Secret columns in registers.** A third-party API-user register kept in a spreadsheet had password columns. The sync requests named non-secret column ranges only; the password columns are never in any request, so they are never in the database, exports, or analyst packets. State this on the page so an auditor sees it.

## Data at rest and on the wire

- Database on localhost only, data directory under the operator's home, never under a cloud-synced folder (corruption *and* exposure).
- Data directory `0700`, database and token files `0600`. Tighten on every start; never loosen; only touch files the current user owns; log once and continue on failure.
- Nightly logical backup with a short retention window, to a local directory outside sync. Verify a restore once.
- The never-truncated schemas (evidence, operator content) have an export/import route for portable backup; import merges and never deletes.
- Every request passes a middleware check: Host must be `localhost`, `127.0.0.1` or `[::1]`; mutating methods refuse `Sec-Fetch-Site: cross-site` and any Origin not matching the Host; a GET with a side effect (an export that captures a snapshot) requires `Sec-Fetch-Site` in `{same-origin, none}` or absent. Only static build assets are exempt. A route that must be called by an external relay carries its own key auth and is explicitly allow-listed.
- Sanitizer on every export, snapshot, stored-payload read and analyst input (see the evidence file). Real identities are kept by decision; anything that can authenticate is removed and the removal is recorded.

## People: screen-share privacy

The operator screen-shares the control-plane with their team. Some pages concern people who are about to be separated, under HR review, or otherwise not for the team's eyes.

- Mark the cohort or item **sensitive** at the data layer, not in the UI. The flag rides the snapshot contract into the database and out to every rendering.
- Sensitive text (names, emails, managers, narratives, device serials, log messages, notes) renders with a CSS blur class: blur, no text selection, no pointer events. Counts, risk levels, phases, checklist progress, times and system states stay readable so the page is still usable while blurred.
- One **Reveal** toggle in the header flips the page; **Escape** re-blurs and closes any open drawer. The revealed state is never persisted; every load starts blurred.
- Text search matches blurred names so the operator can find a row without revealing it.
- Deep-link chips next to a blurred name stay clickable (the chip is not blurred) so one click reaches the vendor record without unblurring the page.
- Downloads (reports, briefs) print in full. They are the HR/legal evidence package and are opened off-screen.
- When an assistant summarizes a schedule or cohort in chat, it refers to "a private item at 14:00" or "the cohort of N people" — never the title or a name — unless explicitly asked.

## People: investigations

The control-plane produces **automation fingerprints** and **exfiltration signals** — API user-agents, sub-second cadence, bursts, token-vs-SSO access, off-hours concentration, unusual Drive sharing in a separation window. These describe *how* work is done. The tool's language, prompts and reports must say so and must stop there.

- Every assessment about a person ends with: automation or risk likelihood (low / medium / high), what additional data would confirm or refute, and non-confrontational next steps.
- Prompts forbid speculation about motive or honesty and treat analyst notes as background data, never instructions.
- Any action affecting an individual — suspension, device wipe, access revocation beyond the scheduled offboarding — is taken by the responsible system owner after HR and legal are involved, not from the control-plane. Where the control-plane offers such a button (an IdP suspend), it is a named exception with a typed-confirmation phrase, a read-only preview first, and a log entry.
- Separation-watch findings carry a Retain-Access / Do-Not-Wipe flag from HR's own worksheet so the tool can never recommend an action HR has already vetoed.

## Dispositions that do not write back

Where a vendor exposes no write API for a disposition (an EDR DLP detection, a posture scanner result), the operator's dismissal or exemption is stored locally with a reason and an owner. Rules:
- Label it **local-only** in the UI and in every report; the vendor's console still shows it open.
- Where the vendor *does* own exceptions (a CNAPP snooze with owner, reason and expiry), record them **there**, not locally, and read them back. Two exception registers diverge.
- Never auto-expire or auto-apply a local dismissal to a new occurrence; each new finding is triaged again.

## Checklist before the first run on a new machine

Work through this once per machine and once per new connector. It takes an hour and prevents every incident this file describes.

1. Confirm the project folder, the database data directory, and the backup directory are **outside** any cloud-synced path. Check the parent directories, not just the leaf.
2. Create or verify a dedicated read-only (or audit-scoped) credential per vendor, named for the control-plane. Confirm the name appears in the vendor's audit log after the first sync.
3. Populate `.env.op` from the example with references into your own vault. Run the check script. Every reference resolves; no value is printed.
4. Delete or move any plaintext `.env.local` and its timestamped backups unless you have consciously chosen the fallback — and if so, confirm the folder is gitignored and unsynced.
5. Start the server and confirm it listens on loopback only. From another device on the network, confirm the port is unreachable. From a browser on the same machine, confirm a request with a non-local Host header is refused.
6. Run the data-directory permission tightening and confirm `0700` on the directory and `0600` on database and token files.
7. Trigger the backup script by hand and perform one restore into a scratch database.
8. Open a page that holds a sensitive cohort and confirm it loads blurred, that Reveal flips it, that Escape re-blurs, and that a reload starts blurred again.
9. Export one dataset and read the `meta.sanitizer` block: dropped paths and redaction counts should be non-zero on at least one page, proving the sanitizer ran.
10. Read the list of write exceptions in the architecture file. For each, confirm the confirm step and the log entry fire in a dry run before any real target is selected.

## Pitfalls & lessons learned

- A placeholder `op://` path from a template was copied into the real env file and "worked" only because a stale plaintext fallback was still present. Validate references on every machine with the check script.
- A tool once ran a legacy SQLite CLI against a path whose files had been migrated away; the CLI silently created an empty database. Remove retired tooling paths from scripts and notes.
- Blur that also disabled pointer events broke the deep-link chip next to the name. Exempt action chips from the blur class.
- Printing even a redacted env while debugging left an email in a terminal transcript that was later screen-shared. Redact emails and IPs in every probe script's output by default.
- A data-plane-read role was initially granted for convenience. It could read object contents the oversight tool never needed. Downgrade to audit scope and re-verify every sync still works.

## Do not

- Do not store a secret value in any file under a synced folder, including backups and example files.
- Do not embed a secret inside a URL variable; it will not resolve and someone will paste it in plaintext.
- Do not request a spreadsheet range that contains a secret column, even if you plan to drop it.
- Do not grant the control-plane a write credential except as a named, confirmed, logged exception.
- Do not hide sensitive rows; blur them.
- Do not quote the title or content of a sensitive item in chat, a summary, or a shared artifact.
- Do not act on an individual from a finding. Hand the lead to HR/legal.
- Do not let a local-only dismissal be reported as if the vendor were updated.
- Do not bind the server to anything but loopback, and do not skip the Host check "because it is local".

## Related steering files

- `foundation-control-plane-architecture.md` — read-only-by-default and the list of write exceptions.
- `foundation-evidence-datasets-snapshots.md` — the sanitizer and why identities are kept.
- `foundation-ai-analyst-triage.md` — prompt guard, leads-not-conclusions language.
- `analysis-access-revocations.md` — the separation-watch page where blur-by-default ships.
- `access-export-api-users.md` — the register whose secret columns are never requested.
- `monitoring-1password.md` — the vault access events used as a signal (references, never values).
