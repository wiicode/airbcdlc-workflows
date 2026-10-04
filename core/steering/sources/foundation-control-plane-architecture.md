---
title: Control-Plane Architecture — a Local, Single-Operator Security Oversight App
category: foundation
system: cross-cutting
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, monitoring-sumologic, monitoring-aws-cloudtrail]
---
# Control-Plane Architecture — a Local, Single-Operator Security Oversight App

## Why this matters

A security team of one or two people has to answer the same questions auditors and incidents ask — who did what, is every endpoint covered, did the leaver's access actually go away — across a dozen vendor consoles. Clicking through consoles does not scale and leaves no evidence. A hosted SIEM answers some of it but bills per query. The control-plane is the middle path: a **local, private, single-user web app** that pulls from every vendor API with read-only credentials, normalizes into one local database, computes findings deterministically, and keeps evidence. It runs on the operator's machine. Nothing is deployed, nothing is exposed, nothing is maintained in the cloud.

Build it this way because the hard parts — authentication to many APIs, a normalization layer, a durable local store, and a shell that can host many unrelated modules — are the same for every oversight question. Get them right once; every new question becomes one connector file and one page.

## Design principles

| Principle | Rule | Because |
|---|---|---|
| **Evidence, not verdict** | Surface how work was done (cadence, user-agent, token vs SSO). Never let the app assert intent. | Automation is usually legitimate. A finding is a lead for a human and, where an individual is involved, for HR/legal. |
| **Read-only by default** | Every credential is read-only or audit-scoped. Any write is an explicit, named exception with a confirm step. | The control-plane is oversight, not enforcement. A compromised oversight tool must not be able to change the estate. |
| **Narrow by default** | Default window 24h, capped result sets, expand on demand. | Metered sources (SIEM search credits) burn fast under unbounded fan-out. |
| **Deterministic first** | Counts, joins, rules, hashes in code. A model only interprets. | Numbers must be reproducible and cheap; a model cannot be allowed to hallucinate a statistic. |
| **One shape for everything** | All activity normalizes to one event row; all oversight pages export one dataset shape. | UI and analysis never special-case a source. |
| **Surface and reuse over redesign** | A new ask is solved by a button on an existing route and table before any new machinery. | New infrastructure (job queues, schedulers) is cost without payoff in a single-operator tool. |
| **Rebuildable vs never-truncated** | Sync data can be wiped and re-pulled. Evidence and operator-authored content can never be. | Mixing them means one reset destroys the audit trail. |

## Reference architecture

```
config/*.json  ──► roster, query presets (editable without a redeploy)

Connectors (one file per source)         API routes (server-side, hold secrets)
  siem        → search-job API             POST /api/refresh   collect window → DB
  cloud audit → LookupEvents per account   GET  /api/events    filtered stream
  idp         → directory insights         GET  /api/summary   actor × source matrix
  edr         → event streams + hosts      GET  /api/status    connector health
  cnapp       → tenant audit log           POST /api/analyze   stats (+ model)
        └──► normalized events ──► local Postgres ──► React shell (modules)
```

Stack that worked: Next.js App Router (one process serves API routes and UI; secrets never reach the client), TypeScript strict, local Postgres on localhost, plain `fetch` for REST (SDKs only where auth is genuinely complex, e.g. AWS STS), Anthropic SDK for the interpretation layer. Fixed non-standard port. Node 22+.

## The connector contract

Every source implements one small interface and registers in one array. Nothing else changes when a source is added.

```ts
type CollectWindow = { from: Date; to: Date };
interface Connector {
  id: string;            // events stored as `${id}` or `${id}:${subsource}`
  label: string;
  enabled(): boolean;    // required env present?
  configHint: string;    // exactly what to set if not
  collect(window: CollectWindow): Promise<NormalizedEvent[]>;
}
export const connectors: Connector[] = [ siem, cloudAudit, idp, edr, cnapp /* … */ ];
```

Rules inside `collect`:
- **Self-report configuration.** The UI shows "not configured" with the exact variables. Turn sources on one at a time.
- **Tolerate partial failure.** Multi-target sources (per account, per preset) collect `errors[]`; throw only when everything failed, otherwise warn and return what succeeded. One broken preset must not zero the run.
- **Capture the automation fingerprint.** Persist user-agent / client id / token name into `detail`. It is the single highest-signal field for human-vs-script.
- **Bisect busy windows** when an endpoint caps records per query. Halve the window until every slice is under the cap.
- **Re-read credentials per run** for expiring schemes (STS/SSO). No code change when the operator re-authenticates.

## The normalized event shape and dedup

```
events(source, event_time, actor, action, target, detail, raw, dedupe_key UNIQUE)
dedupe_key = sha256([source, event_time, actor, action, target, detail].join("|"))
```

Insert with `ON CONFLICT DO NOTHING`. Re-running any window is idempotent, which means the operator can widen a window or replay a day without thinking about duplicates. Keep `raw` for forensics but never export it (see the evidence file). Record every run in a `runs` table (source, window, status, count, error) — the Home page's freshness panel reads nothing else. Stream cursors (event-stream offsets) live in a `connector_state` key/value table so forward-only feeds resume.

## Actor → person resolution

Never hard-code who an identifier belongs to. Keep a roster (`people`) and an `identities(system, identifier, person_id)` join table; `system = '*'` matches any source. Resolve at query time with one join. Unresolved actors surface in a "unmapped" list the operator can assign from the UI. Sync the roster from the system-of-record on boot so leaver state (Going / Gone) is available to every finding rule.

## Module system and sync registry

The app is a **shell that hosts modules**. One registry file declares sections → items → children with `{ id, label, icon, href, status: live|beta|placeholder, blurb }`. The nav, the Home cards, and breadcrumbs all render from it. Adding a module is a registry entry, a route folder, and (for an oversight page) a dataset provider.

The Home page has a **sync center**. Do not build a scheduler for it. Aggregate over the per-module run tables that already exist and POST to the per-module sync routes the page buttons already call. Each target declares `{ id, label, section, href, endpoint, body?, mfaField? }` and knows how to read its own last run. Exclude from the center anything that is checkpointed, MFA-gated, or an investigation follow-up rather than a freshness sync.

**Run multi-target syncs sequentially.** A shared connection with a writer holding a transaction across an `await` will deadlock or interleave under parallel fan-out. One target at a time, in order, with the result of each recorded before the next starts.

## Storage: three schemas by lifecycle

One local Postgres database, three schemas, each behind an async store interface:

| Schema | Holds | Reset policy |
|---|---|---|
| `core` | Sync data (events, inventories, run tables) and operator state that can be re-derived. | `reset-db` truncates it. Rebuildable from the sources. |
| `history` | Snapshots, entity versions, analyst runs — the evidence. Append-mostly, hash-chained. | Never truncated. Prune only by policy with a dry run. |
| `workspace` | Operator-authored content: risk notes, control links, evidence notes, GRC-platform link records and upload log. | Never truncated, never written by a sync. Export/import routes for backup and merge. |

Schema changes are forward-only numbered migration files per schema, applied on first use under an advisory lock, never runtime DDL. Keep an async `Db` wrapper (`prepare().all/get/run`, `tx()`) so the engine stays swappable; the project started on SQLite and moved to Postgres for durability, backups and concurrency without rewriting queries (a dialect translator handled `?` → `$n`, `LIKE` → `ILIKE`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`).

## Config as editable files

Query presets, rosters, routing maps live in `config/*.json`, loaded at runtime. A preset carries a `map` describing which response fields become `actor / action / target / detail`. Tuning a query is a JSON edit, no redeploy.

## Write exceptions (the full list)

Write paths exist only where the operator asked for them, each with its own confirm step and audit log entry: dismissing a SIEM insight back to the SIEM with a resolution and tuning note; suspending an IdP user from the identities page; removing a leaver from a static IdP group; auto-linking an unmapped external device record back to the system-of-record. Everything else — every inventory, every audit log, every metric — is read-only. Vendor-side dismissals the app cannot write (e.g. EDR DLP detections) are recorded locally only.

## Pitfalls & lessons learned

- **API docs lie or omit.** Probe the live tenant with a throwaway script that prints status + redacted body and never prints a secret. 404 (wrong path), 403 (right path, missing scope) and 400 (bad params) each mean a different fix.
- **Verify field names against a real record.** One tenant's audit field was `eventType`, another's `eventName`. Fractional-second timestamps were rejected by one search dialect. Positional vs inline field aliases differ.
- **JSON booleans are lowercase strings in some APIs.** A `success:"false"` filter sent as a boolean returned HTTP 400; a `True` check silently miscounted. Never hand a user a finding from a parse bug.
- **Database files on cloud-synced folders corrupt.** Data dir under the home directory, never under Drive/Dropbox.
- **A process manager needs its locale.** Postgres under launchd died without `LC_ALL` set in the plist.
- **Seeded demo data must be loudly labelled.** A fixture mistaken for a real finding is worse than no demo.
- **Dev server inherits the shell's env.** SSO login in the same terminal, or before, or STS calls fail with a confusing error. Surface a "run your login" hint on the expired-token error.

## Do not

- Do not deploy it. The moment it leaves localhost you need real authN/authZ, CSRF, session hardening and a secrets server — none of which this model provides.
- Do not give it a write credential "for convenience". Add a write path only as a named exception with confirm and log.
- Do not build a job runner or scheduler before the operator asks. Surface existing routes.
- Do not special-case a source in the UI. If the normalized shape cannot express it, fix the connector.
- Do not let a model compute a number. It reads numbers the code produced.
- Do not run multi-target syncs in parallel on a shared connection.
- Do not store `raw` payloads anywhere that exports.

## Related steering files

- `foundation-evidence-datasets-snapshots.md` — the dataset shape every page exposes, and the history schema in detail.
- `foundation-ai-analyst-triage.md` — the interpretation layer that sits on top of deterministic stats.
- `foundation-privacy-safety-secrets.md` — credential handling, localhost lock, screen-share privacy.
- `monitoring-sumologic.md`, `monitoring-aws-cloudtrail.md` — the two connectors that shaped the contract (metered search; expiring credentials).
