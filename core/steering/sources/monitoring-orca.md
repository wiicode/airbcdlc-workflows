---
title: Orca Security — CNAPP admin-plane oversight via the audit-log API
category: monitoring
system: Orca Security (CNAPP)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-ai-analyst-triage, analysis-shift-left-adoption, analysis-actor-automation-fingerprints, monitoring-aws-cloudtrail, foundation-evidence-datasets-snapshots]
---
# Orca Security — CNAPP admin-plane oversight via the audit-log API

## Why this matters
A CNAPP is the system of record for cloud posture and alerts. The control-plane does
**not** try to be a second alert console. What it watches is the **admin plane of the
CNAPP itself**: who logs in, who changes configuration, who dismisses or closes alerts,
what automations and API tokens do. Alert dismissal is the quiet way risk gets accepted
without a record; a steady drip of dismissals with thin justifications is a hygiene
failure auditors will ask about and leadership will not see. Logins and config changes
from unexpected actors are an admin-plane compromise signal for a tool that holds
read access to every cloud account.

Alerts themselves stay in the vendor console, with one deliberate exception: a
deterministic tiering of open critical/high alerts described in a separate file
(analysis-shift-left-adoption covers scan adoption; the findings tiering is documented
with the CSPM module). This file is about the audit surface only.

## Data sources & access method
| Surface | Endpoint | Notes |
|---|---|---|
| Tenant audit log | `GET {base}/users/audit?from=&to=&limit=&start_at_index=` | What the UI shows under Settings → Reports & Logs → Audit Logs. Timestamps `YYYY-MM-DD HH:MM:SS` UTC in the query |
| Shift-left scan runs | `GET {base}/shiftleft/scan_logs/?limit=&start_at_index=` | Per-run: `scan_time`, project, branch, repo, `scan_type`, status, `run_by{origin,email}`, `api_token`; trailing slash required |
| Shift-left project config | `GET {base}/shiftleft/projects/` | Baseline branch, enabled scan types, warn/block mode, `updated_by/at` |
| Alerts, attack paths, inventory | `POST {base}/serving-layer/query` | Read query via POST; used by the tiering layer, not by this connector |

Auth: `Authorization: Token <api-token>`; a **read-only role token** is enough for all of
the above. EU tenants use a different API base. The token is sent only as a header and
never logged; Orca error bodies are vendor messages, trimmed, never the request headers.

Audit entry schema (observed, undocumented):
`{ user_name, activity_time (ISO with offset), action, details{ per-action }, user{ email, first_name, last_name, permissions[{ role_name }] }, api_token }`.
`api_token` non-null = the action was performed via a token — the automation marker.

## Collection tactics
- **1000-record ceiling.** The audit endpoint hard-caps retrieval per query
  (`start_at_index` max = 1000 − `limit`). Fetch two pages of 500; if the window came back
  full, **bisect the window and recurse** (bounded depth, stop at a one-minute window) so
  busy days still get full coverage.
- `data` may arrive as an array, a JSON **string**, or `{ items: [...] }` — normalize all three.
- Scan-run collection pages newest-first; stop once a page's oldest `scan_time` is before
  the window. Emit **notable scans only** by default to avoid flooding the stream with
  routine per-commit CI scans: token-performed, vendor-initiated (`run_by.origin = orca`
  or vendor email), failed, or release-branch scans. An env override emits everything.
- Project config: emit one event per project whose `updated_at` falls in the window.
- The audit log is the source of record for the run; a scan-log or project-config failure
  must **not** zero the run — collect partial errors and warn.
- Rate limits are tight on the Serving Layer (bursts → 429); space requests, honour
  `Retry-After`, back off exponentially, retry 5xx a bounded number of times.

## Normalization & joins
| Field | Audit entry | Scan run | Project config |
|---|---|---|---|
| `actor` | `user_name` → `user.email` → token name | `orca-token:<name>` when token-run, else `run_by.email` | `updated_by` → `created_by` |
| `action` | `action` (vendor verb: login, dismiss_alert, update_settings …) | `appsec_scan` / `appsec_scan_failed` | `appsec_project_config` |
| `target` | first of `details.issue_title`, `alert_id`, `name`, `saved_view_name`, `rule_name`, `repository_name`, `asset_name`, `framework` | `project:branch` | project name |
| `detail` | `token=<name> role=<role_name> k=v…` (scalars and scalar arrays from `details`) | `scan_type status branch repo ci token origin` | `baseline=<branch> scan_types=<list>` |

Keep the role from `user.permissions[0].role_name` in `detail`; admin-role actions are
reviewed differently from read-only-role actions.

Actor → person: emails resolve through the roster ladder. Token actors are automation,
labelled as such with the token **name only** — the scan log's `api_token` object carries
`{ id, name, created_by, service_token }`; keep name/id/service flag, never anything else.

## Signals & finding rules
| Signal | Rule | Why |
|---|---|---|
| Alert dismiss / close / snooze | `action` in the dismissal family | Accepted-risk hygiene; every dismissal should have a justification and a reviewer |
| Dismissal burst | one actor dismisses many alerts in a short window | Bulk acceptance without review |
| Admin config change | `action` in settings/integration/role/user families with an admin role | Admin-plane change control |
| Login from new actor or off-roster | `login*` where actor resolves to nobody or to Gone | Admin-plane compromise / offboarding gap |
| Token-performed action | `api_token` present on an audit entry | Automation inventory; new token names are a finding until named |
| Failed scan | `scan_failed = true` | Shift-left pipeline health |
| Vendor-initiated scan | `run_by.origin = orca` | Expected but worth listing (support activity) |
| Baseline branch changed | `appsec_project_config` with a different `baseline` than last snapshot | Changes what counts as "new" findings |

Dismissal oversight pattern used in the tiering layer: a monthly **random sample** of
dismissed/closed alerts (fixed size, drawn and stored) for human review of justification
quality. The Serving Layer does not expose who changed an alert's status, so "who" comes
only from the audit log — join `details.alert_id` across the two.

## Analyst triage & evidence
- Audit-plane view: logins by actor with roster status; config changes; dismissals with
  justification text; token activity. Window toggles 24h/7d/30d.
- Triage vocabulary: EXPECTED (named admin, change record) · RECERTIFY (admin role on an
  account that should be read-only) · INVESTIGATE (off-roster login, unnamed token,
  dismissal burst) · HYGIENE (dismissals without justification).
- Evidence: counts are deterministic over stored rows with the rule written down in the
  dataset's `context.definitions`. AI never sits in the evidence path; if AI commentary is
  added it is labelled commentary and follows the terse contract.
- Push the dismissal-sample CSV and the adoption CSVs to the GRC platform (e.g., Vanta)
  as evidence for the vulnerability-management and secure-development controls; mark a
  dataset `incomplete` until its backfill finished so auto-pushes skip it.

## Pitfalls & lessons learned
- The audit log does **not** record scan executions or baseline configuration (verified:
  zero scan actions over a month). Pull `shiftleft/scan_logs` and `shiftleft/projects`
  separately or you will conclude nobody scans anything.
- Legacy alert and compliance-stats endpoints return 405 (deprecated); the Serving Layer
  is the live read path. Verify endpoints against your tenant before building.
- The cloud-account listing payload embeds **presigned onboarding URLs with STS session
  tokens**; whitelist the fields you store.
- Secret-detection findings carry partially masked secret material in `RiskFindings.match`
  and `code_snippet`; never store those fields.
- Vendor AI/MCP assistants are not reproducible evidence and consume credits; keep
  oversight on the REST API.
- Scheduled vendor scans arrive with `run_by.origin = user`; distinguish them by label,
  not by origin, or they inflate "user-run" counts.

## Do not
- Do not rebuild the alert console; link out.
- Do not store token values, presigned URLs, or secret match snippets.
- Do not let an AI classify dismissals as acceptable; sample and have a human read them.
- Do not emit every CI scan into the activity stream by default.
- Do not export tenant ids, cloud account ids, or repo URLs in evidence; export names and
  counts.

## Related steering files
foundation-control-plane-architecture · foundation-ai-analyst-triage ·
analysis-shift-left-adoption · analysis-actor-automation-fingerprints ·
monitoring-aws-cloudtrail · foundation-evidence-datasets-snapshots
