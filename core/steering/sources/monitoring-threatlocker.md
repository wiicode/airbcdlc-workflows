---
title: ThreatLocker — policy blocks as hourly rollups, zero-block posture
category: monitoring
system: ThreatLocker (application allowlisting / Portal API)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, monitoring-sumologic, analysis-edr-coverage, analysis-endpoint-fleet-inventory, monitoring-crowdstrike, foundation-evidence-datasets-snapshots]
---
# ThreatLocker — policy blocks as hourly rollups, zero-block posture

## Why this matters
Application allowlisting is a default-deny control: once a fleet is in secured mode, a
block is either an attack, a misconfiguration, or a policy that was never tuned for the
workload. In every case it needs a human. That gives this feed a rare property — **a
healthy fleet produces zero events**. Anything that appears is high-value and triaged
fast: what fired, on which host, under which policy, how often.

The same records are read two ways and corroborate each other: the SIEM copy is the
detection trail (rollups into the events rail); the Portal API copy is ground truth
(every record, per-record drill-down). When they disagree, the relay or collector is broken.

## Data sources & access method
| Source | Method | Role |
|---|---|---|
| Unified Audit action log → SIEM | An agent/relay forwards raw action-log records to an HTTP source; a Search Job preset rolls them up | Detection trail; events rail; dedupe-friendly rollups |
| Portal API action log | `POST {base}/portalapi/ActionLog/ActionLogGetByParametersV2` | Ground truth; per-host/per-policy drill-down; raw JSON drawer |
| Portal API computers | `POST {base}/portalapi/Computer/ComputerGetByAllParameters` | Fleet state: mode (Secure / Learning / MonitorOnly / Installation), last check-in, denied count, agent version |
| OpenAPI spec | `{base}/swagger/public/swagger.json` | The real machine spec; another swagger path may be an empty stub |

**Authentication (Portal API)** — three custom headers on every request:
- `Authorization: <api-key>` — the key **verbatim**, no `Bearer` prefix.
- `ManagedOrganizationId: <org guid>` — **required**; without it the search endpoint
  answers `200 []` for every query (no error, just nothing).
- `OverrideManagedOrganizationId` — optional.

Confirm the tenant's **instance** (regional API host letter shown in the portal). A token
sent to the wrong instance may be rejected with a misleading "token revoked" style error.
The key is read from env, sent only as a header, never logged or persisted.

## Collection tactics
**SIEM rollup preset** (records mode)
- Filter `action != Permit`; extract `action`, `actionType`, `hostname`, `username`,
  `fullPath`, `policyName`, `isMonitorMode`.
- `timeslice 1h | count by _timeslice, action, type, host, user, path, policy, monitor`.
- **Floor the window end to the last complete hour.** A partial-hour row would re-insert
  with a different count on the next refresh and litter the stream with superseded rows;
  with flooring every rollup row is final and dedupes identically across refreshes.
- Event time = `_timeslice`; the connector must read it (messages carry `_messagetime`,
  records carry `_timeslice`).
- The forwarded feed may carry only non-Permit actions; confirm before assuming Permit
  volume is available there.

**Portal API pull**
- Window default 24h, cap at ~30 days; pageSize 500; a page cap of a few dozen per sync.
- The working recipe on a modern tenant needs **all** of: header `usenewsearch: true`
  (routes to the live search backend — the only path that returned Linux agent logs);
  the `ManagedOrganizationId` header; a body matching the `ActionLogParamsDto` schema
  with a **non-empty `paramsFieldsDto`** (send the portal's default "Remove White Noise"
  filter entry — omitting the array returns 500); `actionId` for Deny (the combined
  "any deny" code returned nothing on the new search path).
- `showChildOrganizations: true` covers child orgs from the parent org id.
- Keep an env escape hatch that merges extra JSON into the body (e.g. `{"actionId": null}`
  to include Permits) so tenant quirks are matched without a code change — mind the volume.
- Empty result = **zero-byte body** or `[]`; handle both. Response may be an array or
  `{ data | records | items | results: [...] }`.
- 429 → honour `retry-after`, else exponential backoff, bounded attempts.
- The search backend caps page×size at roughly ten thousand records per query window;
  keep pull windows short enough for your deny volume or the tail truncates.
- Idempotent upsert keyed on `eActionLogId`; fall back to a content hash (time, host,
  user, path, action, type) when the id is missing. Append-only; a re-sync only bumps
  `last_synced_at`. One transaction per page.

## Normalization & joins
Rail event from the rollup: `actor = username`, `action = "<action> · <actionType>"`
(e.g. `Deny · execute`), `target = fullPath`, `detail = host · policy · count`.

Portal rows persist: `date_time`, `hostname`, `username`, `action`, `action_type`,
`full_path`, `process_path`, `created_by_process`, `policy_name`, `policy_id`,
`is_monitor_mode`, `application_name`, `sha256_hash`, `device_type`, `os_type`,
`computer_id`, `threat_severity_level`, raw JSON (truncated).

Joins: `hostname` → fleet inventory / system-of-record device (owner, site, hardening
phase); `username` is an endpoint-local account (often `root`/`SYSTEM`), not a person —
do **not** push it through the roster ladder as if it were an email. `policy_name` → the
policy table for mode and scope.

## Signals & finding rules
| Signal | Rule | Note |
|---|---|---|
| Any Deny in secured mode | `action = Deny` and `is_monitor_mode = false` | The headline; expected count is zero |
| Monitor-mode deny | `is_monitor_mode = true` | Would-block preview; tune before securing |
| Repeated block of one path | same host/path/policy across many hours | A workload the policy never learned — misconfiguration, not attack |
| Block of a management agent | `full_path` matches an RMM/EDR/patching agent or container runtime | Breaks operations; escalate to the rollout owner |
| New host blocking | first-seen `hostname` with denies | Onboarding/baseline gap |
| Default policy firing | `policy_name` is a platform default (e.g. "default - <os>") | The fleet lacks application-specific policies |
| Elevated severity | `threat_severity_level` high + unknown `sha256_hash` | Real malware candidate; correlate with EDR |

Posture metrics per window: actions, denies, hosts with denies, monitor-mode share, last
action time, stored total. Breakdowns: blocked paths, hosts, policies (click to filter).

## Analyst triage & evidence
- Panel: sync button with pull-window select; window toggles 24h/3d/7d/30d; tiles;
  breakdowns; searchable table; raw-JSON drawer per record.
- Triage vocabulary: TUNE-POLICY (legitimate workload blocked) · ESCALATE-ROLLOUT (agent
  or runtime blocked) · INVESTIGATE (unknown hash, elevated severity, new host) ·
  EXPECTED (monitor-mode preview during learning) · BROKEN (SIEM rollup and API disagree).
- Evidence: deny counts per host/policy per day as a dataset snapshot; the posture tiles
  as metrics. No hostnames in distributed exports — export host counts and policy names.
- Corroboration check: rollup sum over a complete hour should equal the API count for the
  same hour; log the difference as a collector health metric.

## Pitfalls & lessons learned
- The "expect zero" assumption was false on first pull: a default OS policy in **secured
  mode** was denying another vendor's RMM agent, the container runtime, and common
  archive/download tools on pilot hosts. Triage **before** widening a rollout; the first
  sync is a rollout gate, not a dashboard.
- Upstream naming typos happen (a collector name with a missing letter). Match with a
  wildcard and document it; do not "fix" the upstream name mid-stream or history splits.
- Two swagger documents may exist; only the public one is real. The legacy query path
  returned 200-empty for everything while per-record lookups worked — probe the live
  search path first.
- The API answers empty with a zero-byte body, not JSON. A strict JSON parser fails
  the sync on a quiet day.
- Deny volume during a pilot can be thousands per day; keep API windows short and rely
  on the hourly rollup for the long view.
- Permit volume is an order of magnitude larger than Deny; only pull it for a targeted
  hunt.

## Do not
- Do not send the API key with a `Bearer` prefix or omit the organization header.
- Do not emit partial-hour rollup rows.
- Do not resolve endpoint usernames as people.
- Do not treat monitor-mode denies as incidents.
- Do not export hostnames, org ids, or file hashes tied to hosts in shared evidence.

## Related steering files
foundation-control-plane-architecture · monitoring-sumologic · analysis-edr-coverage ·
analysis-endpoint-fleet-inventory · monitoring-crowdstrike ·
foundation-evidence-datasets-snapshots
