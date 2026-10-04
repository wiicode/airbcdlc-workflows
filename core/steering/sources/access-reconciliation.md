---
title: Cross-System Access Reconciliation and License Bleed
category: access
system: IdP (JumpCloud), Atlassian, Google Workspace, Slack, Microsoft Entra, Azure DevOps vs. the people system-of-record
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, access-atlassian, access-identity-lifecycle, access-groups, analysis-source-control-azure-devops, analysis-access-revocations]
---
# Cross-System Access Reconciliation and License Bleed

## Why this matters

Every SaaS estate drifts away from the people roster. Leavers keep paid seats, contractors are never removed, accounts exist that no one owns, and some people sign in to SaaS tools without ever passing through the IdP. Each of these is both a security exposure (an account that can still sign in) and a cost leak (a seat still billed). Auditors ask the same question from two directions: "show me that leavers lost access" and "show me who has access and why".

The method here answers both with one engine: pull every account from every system into one normalized table, join by email against the people system-of-record, and compute deterministic findings at read time. The control-plane stays an oversight surface — read-only by default, with a tiny, guarded write side for the two systems where an API deactivation is unambiguous.

## Data sources & access method

| Source | Role in the join | Access method | Mode label |
|---|---|---|---|
| People system-of-record (HR/people table) | Authority on *who should exist* and their lifecycle status | Vendor REST API, read-only key | `live` |
| IdP (JumpCloud) | Where human accounts are born; every SaaS account should trace back here | Local table filled by the Identities page sync (`GET /api/systemusers`, paged) | `local` |
| Atlassian | Billable seats, product access, guests | Org admin API `admin/v1/orgs/{org}/users` with an org API key | `live` |
| Google Workspace | Mailboxes, suspended-but-licensed, admins | Admin SDK Directory `users.list`, installed-app OAuth client, read-only directory scopes | `live` (or `snapshot` / `import`) |
| Slack | Paid members, guests, bots, deactivated | `admin.users.list` with an org-level token (`admin.users:read`, `admin.teams:read`); falls back to workspace `users.list` | `live` (or `snapshot` / `import`) |
| Microsoft Entra ID | Enabled/disabled, guest vs member, paid SKUs, sign-in activity | Microsoft Graph via delegated CLI token or app registration | `live` |
| Azure DevOps | Entitlements (Basic vs Stakeholder), PAT ledger | Local tables from the Source Control sync plus the org audit log | `local` |

Key design points on access:

- Read-only credentials everywhere by default. Only Atlassian deactivation and Google suspend have a write path, and both are opt-in scopes (see *Analyst triage & evidence*).
- Where credentials do not yet exist, use whatever the system-of-record already holds (a prior workload's directory snapshot) **and label it `snapshot`**. Where even that is absent, let the operator drop in a console CSV export (`import`). Both are stopgaps; the label travels with every row.
- Status endpoints must tell the operator *which mode each source is in* and *what one step would make it live*. The page strip shows `live / local / snapshot / import / none` per source with a hint string.

## Collection tactics

- **One normalized row per (source, account_id).** Upsert on that key; `gone_at` is set when a full sweep no longer returns the account. Never delete rows — tombstone them.
- **Every puller returns `{rows, mode, snapshotAt, note}`.** Snapshot pullers set `snapshotAt` to the snapshot's own date; live pullers set it null. Downstream rules use this to decide what counts as evidence.
- **A fresh CSV import outranks a stale snapshot.** If the operator imported a console CSV within the freshness window (7 days is a sensible default), a scheduled sync must not overwrite it with the older snapshot. Record a run with `note: "kept import"` instead.
- **Normalize status vocabularies at pull time**, not at rule time: `active`, `billable`, `is_admin`, `is_guest`, `is_bot`, `last_active`, plus a free-text `status` and a JSON `extra` blob for vendor-specific facts (product list, PAT counts, deactivation date, guest expiry).
- **Idle days for snapshot rows are measured against `snapshot_at`, not now.** Otherwise a months-old snapshot makes everyone look idle.
- **Treat vendor placeholders as null.** A year-0001 "last accessed" means "never", not hundreds of thousands of idle days. A `pending` Azure DevOps entitlement (invited, never signed in) is not billable — the vendor bills Basic only after first sign-in.
- **Sync sources one at a time.** Several syncs share one DB connection pattern; running them concurrently caused interleaved transactions. Sequential is cheaper than a job queue.

## Normalization & joins

```
ar_accounts(source, account_id PK, email, display_name, status, active, billable,
            is_admin, is_guest, is_bot, person_type, last_active, created,
            extra JSON, mode, snapshot_at, first_seen, last_seen, gone_at)
ar_sync_runs(source, started_at, finished_at, status, mode, count, marked_gone, error)
```

Join key is lower-cased email. Group all live rows by email; the system-of-record row (if any) is the anchor and contributes `status`, `person_type`, `terminated`, and any alias fields. Roster status vocabulary used by the rules (adapt to yours):

| Roster status | Meaning for the rules |
|---|---|
| Active, Coming | Entitled; expected to have IdP + SaaS accounts |
| Going | Leaving; active accounts tolerated until the termination date |
| Gone, Suspended | Not entitled; any active account is a violation |
| Preserve | Legal/data hold; sign-in should stop, data retained |
| Service Account | Expected non-human; only idle paid seats are interesting |
| Ignore, Alias, Group, shared mailbox, Missing | Never graded |

Billable seats per identity = count of sources where `billable` is true, the row is not snapshot-only, and the account is active (Google counts even when suspended, because Google keeps billing a suspended user until archived or deleted).

## Signals & finding rules

All rules run at read time, so a rule change applies on the next refresh and nothing is baked in at sync. Each identity collects every kind that fires; the worst becomes the headline.

| Kind | Severity | Rule | Default action verb |
|---|---|---|---|
| ACCESS-VIOLATION | high | Roster Gone/Suspended/Preserve, yet active in a live source | suspend / deactivate (Preserve: suspend sign-in, retain data) |
| ORPHAN | high | Active in a live source, no roster record at all (guests exempt) | identify owner; deactivate if unclaimed; add to roster or mark Service Account |
| LICENSE-BLEED | medium | Paid seat whose holder is **not entitled**: roster Gone/Suspended/Preserve, no roster record, or IdP-suspended; also Google suspended-but-licensed | reclaim the seat (system-specific verb) |
| IDP-BYPASS | medium | Active, non-guest, non-bot SaaS account with no IdP identity for an Active/Going/unknown person | create the IdP identity and bind the app, or deactivate |
| IDP-GAP | low | Roster Active employee/contractor/intern with no IdP account | create the account or fix the roster type |
| PAT-RISK | medium | Active Azure DevOps PAT held by a gone/unknown person; or full-access / long-lived (>180 d) token | revoke / re-issue narrow + ≤90 d |
| IDLE | info | Entitled person, paid seat, no activity beyond the window (90 d default) | ask whether the seat is still needed |
| LEAVING | info | Roster Going and still active, nothing else fired | note the termination date |
| LEAD | low | Would be one of the above, but **the only evidence is a snapshot source** | VERIFY in the console first, then the underlying verb |
| EXEMPT | — | An identity-level exemption is in force; shows "was `<kind>`" | none |

Rules the team settled on after arguing with the data:

- **Bleed is entitlement, not usage.** Idle seats were originally counted as bleed and the number was unusable. Idle now lands in its own informational bucket; an operator toggle (off / 30 / 60 / 90 d) promotes idle to bleed for a run, and the brief states that the toggle was on.
- **Snapshot evidence can only raise a LEAD.** A snapshot predating a suspension showed a user as active weeks after they were fixed. Live, local, and fresh-import rows confirm; snapshot rows lead. Keep `bleed_by_source` and `bleed_leads_by_source` as separate counters.
- **Guests never orphan.** Portal-only customers, single-channel guests, and Entra guests are expected to lack roster records.
- **Service accounts are expected to exist.** They flag only for idle paid seats.

Each finding carries `actions[]` of `{system, verb, why[]}`, rendered as an indented second row under the record. Operators preferred this to a narrative "detail" column: the bold system name says *where to go*, the verb says *what to do*, the why list says *what the evidence was*.

## Analyst triage & evidence

- **Brief export** (Markdown and JSON): rules encoded, per-source mode/freshness table, headline counts, then one section per kind with the fix text and a row per identity. Scopes: `action` (high + medium), `violations`, `bleed`, `all`. Agent-facing; no upstream writes.
- **Analyst report.** The evidence packet is the brief's data plus `delta` (resolved / new / kind-changed / seats-at-risk before and now, computed deterministically from the previous stored run), `actions_since_last` (page actions logged since the last report), `exemptions`, and a bounded `queue` (all high, then medium/low capped). Triage vocabulary: **REVOKE** (access must end) · **RECLAIM** (seat released) · **RECERTIFY** (owner must attest) · **EXPECTED** (fine, with rationale) · **LEAD** (snapshot — verify) · **HYGIENE** (roster cleanup). The "Since last report" section is how the work gets documented for compliance.
- **Exemptions.** Table `identity_exemptions(email, source NULL|<source>, disposition, reason, author, expires_at, revoked_at)`. `source NULL` mutes the whole identity (kind EXEMPT); a source value ignores one account while grading (rendered struck-through). Dispositions: `expected`, `false-positive`, `accepted-risk`, `service-account`. Reason is mandatory; expiry optional (90/180/365 d). Exemptions that cover a source another page also grades are mirrored into that page's disposition table with a distinct author, and read back the other way — so the Source Control report and this page agree on who was reviewed.
- **Write side, kept deliberately small.** Two-phase: preview re-reads *live* state and the vendor's capability flag; execute writes, logs to `ar_actions(system, action, account_id, email, ok, http_status, before, after, note)`, and mirrors the local row immediately because the vendor API may lag the console by hours. Idempotent: an already-inactive account short-circuits. Slack gets a console link only — the operator judged the console faster than SCIM for one-offs. Inline two-click confirm on every destructive button.
- **Only cross-page action by default** is a link to the identity page pre-seeded with the email, so the suspend flow lives in one place.

## Pitfalls & lessons learned

- **The vendor API lags its own console.** An Atlassian account deactivated from the page still read active/billable half an hour later. Mirror locally and tell the operator.
- **The 0-byte client file.** A Google client JSON check that only tested file existence showed a bogus "Connect" link; validate the JSON.
- **Split credential fields.** The OAuth client lived in the secrets manager as separate client-id / secret / refresh-token fields, not one JSON blob. A small helper assembled both the client and token files from them, so no new consent was needed — the stored refresh token was still valid.
- **Scope creep in the token.** The read-only refresh token cannot suspend; the suspend button must degrade to "Open in Admin console" plus a "grant scope" re-consent link rather than fail.
- **Sticky actions column.** The actions column sat far off-screen on wide tables; pinning it sticky-right was the single most-requested UX fix. Surface over redesign.
- **Snapshots lie by omission.** Anything older than the last offboarding batch will contradict the fix. Label, downgrade, and separate the counters.
- **The idle KPI was noise** until idle and bleed were split.
- **Whole-org Slack needs an org-level token.** Workspace tokens see one workspace of an Enterprise Grid; billing (`team.billableInfo`) needs a scope the app manifest may not grant — infer paid from membership type and say so in the note.

## Do not

- Do not count a snapshot-only account as a confirmed violation or as bleed.
- Do not promote idleness to bleed by default; make it an explicit operator toggle and record it in the brief.
- Do not act on the local mirror — every execute re-reads live state first.
- Do not widen the write side beyond systems where the API deactivation is unambiguous and billing-affecting.
- Do not delete rows from the account table; tombstone with `gone_at`.
- Do not run multiple source syncs concurrently against a shared connection.
- Do not let an exemption exist without a reason, and do not let a muted identity vanish — show "was `<kind>`".
- Do not export raw vendor blobs; `extra` is curated JSON, not the API response.

## Related steering files

- foundation-control-plane-architecture — connector interface, local DB, sync registry
- foundation-evidence-datasets-snapshots — page dataset, snapshot, delta, hash chain
- foundation-ai-analyst-triage — persona config, evidence packet budget, triage vocabulary
- foundation-privacy-safety-secrets — scopes, token storage, redaction
- access-atlassian — the Atlassian slice (billable mapping, deactivate action)
- access-identity-lifecycle — joiner/mover/leaver rules that reuse these account tables
- access-groups — IdP group hygiene for leavers
- analysis-source-control-azure-devops — PAT ledger and entitlement findings mirrored here
- analysis-access-revocations — proving revocations happened
