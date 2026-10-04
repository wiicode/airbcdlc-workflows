---
title: Third-Party API User Register — Read-Only Sync of a Spreadsheet Credential Store
category: access
system: Google Sheets API (spreadsheets.readonly) + ticketing links
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [access-reconciliation, foundation-privacy-safety-secrets, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, analysis-pentest-cadence, monitoring-google-workspace]
---
# Third-Party API User Register — Read-Only Sync of a Spreadsheet Credential Store

## Why this matters

Many products grant third parties (integrators, reporting vendors, partners) API users per customer. The register of who holds which user, for which customer, granted by which ticket, with which escalation contact, very often lives in a spreadsheet — and that spreadsheet very often also holds the passwords. The security team needs the register (to answer "who has an API user for this customer and who approved it") without ever touching the secrets, and needs to notice when a row disappears, when a grant has no ticket, or when a third party is marked non-compliant with the integration contract. This file describes a read-only, range-bounded, header-guarded sync that gets the register into the control-plane while making credential leakage structurally impossible.

## Data sources & access method

| Item | Detail |
|---|---|
| Source | One spreadsheet; a production tab with a header row partway down (a title block and a declared row count above it) and a companies tab mapping customer id → display title |
| Row shape | third-party name · customer · user-issue escalation contact · integration-compliant (yes/no) · user id (integration header value) · username (its cell carries a **hyperlink to the granting ticket**) · *password column* · customer id · location id · secondary read-only user · *its password column* · which APIs/reports the user may call |
| Access | Google Sheets API `spreadsheets.get` with `ranges[]` and a `fields` mask limited to `formattedValue` and `hyperlink`; OAuth installed-app client already used for the Directory sync, with `spreadsheets.readonly` added |
| Ticket | Key extracted from the hyperlink with a generic `[A-Z][A-Z0-9]+-\d+` pattern; stored as `ticket_url` + `ticket_key`; no ticketing API call needed |

The Sheets API must be enabled on the OAuth client's cloud project (one-time, console side), separate from granting the scope.

## Collection tactics

Defence in depth against the password columns — four independent layers, each sufficient alone:

| Layer | Mechanism |
|---|---|
| Request | Only explicit ranges: the declared-count cell, then `A{header}:F`, `H{header}:J`, `L{header}:Q` (skipping the two password columns), plus the companies tab. Never the whole tab, never a range that spans a password column. |
| Header guard | Columns are mapped by **normalized header text**, not position. If any returned header contains "password", the run ends in `error` and **nothing is stored** — a column insert upstream could otherwise shift a secret into a requested range. Missing username / user-id headers also abort. |
| Storage | `raw` holds only the mapped non-secret fields. The tables have no password-like column; a test asserts it. |
| Dataset | The page dataset provider reads the same tables, so exports, snapshots, and analyst packets cannot contain a credential. |

Other collection rules:

- Match the header row by its known 1-based index and refuse blocks that start elsewhere ("ranges must start at the header row").
- The username header appears twice (API user, secondary read-only user); first by column wins `username`, second becomes `secondary_user`.
- Key = user id, falling back to username; rows with neither are skipped and counted. A user id that appears on two rows keeps the second row with a `#row{n}` suffix so the view can report it rather than collapsing two customers into one record.
- Read the declared count cell and record `declared_count` on the run; the page shows declared vs parsed so a truncated read is visible.
- Full-sweep lifecycle via the shared snapshot helper: `first_seen / last_seen / gone_at`. Removed rows are tombstoned, never deleted.
- Record `sheet_revision` on each run for provenance.

First-run checklist (in order; each step is observable on the page):

1. Confirm the OAuth token carries the Sheets scope (banner clears) and the Sheets API is enabled on the client's project.
2. Run the sync once against a fixture copy of the sheet with a deliberately inserted "Password" header and confirm the run ends in `error` with zero rows stored.
3. Run against the real sheet; compare parsed active rows to the declared count and reconcile any delta before trusting findings.
4. Export the dataset and grep the export for any value that looks like a secret (long random string, not matching a username or id pattern) — expect none.
5. Capture a labelled snapshot; the next review's "since last" diff starts here.

## Normalization & joins

```
export_api_users(key PK, row_no, third_party, company, escalation_contact,
                 compliant_raw, compliant 0|1|NULL, user_id, username,
                 ticket_url, ticket_key, customer_id, location_id, secondary_user,
                 reports, api_flags..., raw JSON, first_seen, last_seen, gone_at)
export_api_companies(company_id PK, title, first_seen, last_seen, gone_at)
export_api_sync_runs(started_at, finished_at, status, users_count, companies_count,
                     inserted, updated, marked_gone, declared_count, sheet_revision, error)
```

- `customer_id` → `export_api_companies.title` for display.
- `compliant`: `yes…` → 1, `no…` → 0, anything else null (unknown is not non-compliant).
- Search covers username, user id, company, third party, contact, and ticket key — the questions people actually ask ("who is behind this user id in the logs?").
- Optional join: the third-party name against the vendor register in the GRC platform (e.g. Vanta) to flag API users for vendors with no vendor record.

## Signals & finding rules

All computed at read time from the snapshot tables; no stored state.

| Kind | Rule | Why it matters | Triage default |
|---|---|---|---|
| `no_ticket` | active row, no hyperlink on the username or user-id cell | grant without an approval record | TICKET |
| `no_contact` | active row, empty escalation contact | nobody to call on abuse or incident | CONTACT |
| `non_compliant` | `compliant == 0` | third party ignores the integration-header contract | ENFORCE |
| `no_user_id` | keyed by username only | cannot be matched to request logs | INVESTIGATE |
| `duplicate_username` | same username on more than one active row | copy-paste slip or shared identity | INVESTIGATE |
| `duplicate_user_id` | same user id on more than one active row | two customers on one API identity | INVESTIGATE |
| `gone` | tombstoned since an earlier sync | the sheet is a register, **not** the system of record — confirm deprovisioned in the product | CONFIRM-REMOVED |
| `new_7d` | first seen within 7 days | recent grant to review | TICKET / EXPECTED |
| `declared_delta` | parsed active rows ≠ declared count | truncated read or stale counter | INVESTIGATE |

Stat tiles double as filters (all · no ticket · no contact · non-compliant · duplicate · removed · new). Removed rows are hidden unless the *Removed* tile is on, then shown muted and struck through.

## Analyst triage & evidence

- **Dataset** id per the page-dataset standard, collections `user` and `company`; exports and snapshots carry the mapped fields only. Snapshot on every export; "since last" diffs show grants added and removed between reviews.
- **Analyst persona**: "SecOps analyst — third-party API users". Triage vocabulary: **TICKET** (obtain or link the approval) · **CONTACT** (obtain an escalation contact) · **ENFORCE** (bring the third party to the integration contract or revoke) · **CONFIRM-REMOVED** (verify deprovisioning in the product for a vanished row) · **EXPECTED** · **INVESTIGATE**. The packet includes the declared vs parsed count and the sync error string so the model can say "coverage incomplete" rather than invent.
- **Evidence for the GRC platform**: the report answers the vendor-access control ("third-party access is approved, recorded, and reviewed") with the per-row ticket key as the approval reference.
- **Raise the sheet itself as a finding.** A register that stores plaintext production passwords is a credential store without access control, versioning of secrets, or rotation. The control-plane's job is to surface that as its own risk item (owner: product security), not to work around it forever.

## Pitfalls & lessons learned

- **OAuth scope re-consent.** Adding `spreadsheets.readonly` to the scope list does nothing for a refresh token consented earlier; the sync 403s with a confusing error. Detect it: compare granted scopes (from the token refresh response, or the scopes recorded at consent time before the first refresh) and show a banner "re-connect Google once to grant the Sheets scope" with the connect link. The consent click is the operator's, never the agent's.
- **Drop the cached access token after re-consent**, or the old scope list is reported for up to an hour and the sync keeps failing.
- **`include_granted_scopes=true`** on the auth URL so re-consent adds rather than replaces.
- **The ticket lives in a hyperlink, not a column.** Pulling `formattedValue` alone loses it; add `hyperlink` to the `fields` mask.
- **Header whitespace and newlines.** Normalize (lower-case, collapse whitespace) before matching; never match by position.
- **Two rows, one user id** appeared live (two customers sharing an identity); the first parser collapsed them. Keep both and report.
- **A removed row is not a revocation.** The register changes when someone edits a spreadsheet; the product changes when someone deprovisions. Treat `gone` as a prompt to verify.
- **Declared count drifts** from reality; it is a human-maintained cell. Show the delta, do not trust it.

## Do not

- Do not widen the requested ranges — ever — even "just to see the header".
- Do not request a whole tab, a whole column set spanning the password columns, or use `values.get` on `A:Z`.
- Do not store the sheet row; store mapped fields only.
- Do not continue a run after a password header is detected; abort with nothing written.
- Do not perform the OAuth consent on the operator's behalf.
- Do not treat a vanished row as a confirmed revocation.
- Do not write to the sheet from the control-plane; it is a read-only register.
- Do not describe secret columns by letter in distributable documentation; say "the password columns".

## Related steering files

- access-reconciliation — the shared Google OAuth client and scope-capability pattern
- foundation-privacy-safety-secrets — scope minimization, token storage, redaction tests
- foundation-evidence-datasets-snapshots — dataset provider, snapshots, since-last diffs
- foundation-ai-analyst-triage — persona and packet pattern
- analysis-pentest-cadence — companion product-security register with the same sync shape
- monitoring-google-workspace — Workspace telemetry for the same OAuth client
