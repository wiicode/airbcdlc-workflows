---
title: Slack — Enterprise Audit Log, AI Provenance and Access Snapshots
category: monitoring
system: Slack Enterprise Grid (Audit Logs API via SIEM, admin.users API, Web API)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-privacy-safety-secrets, foundation-evidence-datasets-snapshots, monitoring-sumologic, access-reconciliation, analysis-actor-automation-fingerprints, analysis-ai-dev-lifecycle, access-identity-lifecycle]
---
# Slack — Enterprise Audit Log, AI Provenance and Access Snapshots

## Why this matters
Slack is where work, files, and increasingly AI agents meet. The enterprise audit log is the best covert-investigation rail most teams already own: it carries user agent, IP, session, client type (desktop, mobile, web), and file titles for uploads and downloads, per person, with no endpoint agent required. It is also the first place AI provenance shows up: app installs, MCP/tool calls made by assistants on a user's behalf, and messages posted through the API as a user. Finally, the member roster is a licence and access-review input (guests, deactivated, bots) that is cheap to snapshot and expensive to ignore.

This file is explicit about what shipped and what is planned. Shipped: the audit log rail through the SIEM, the roster pull for access reconciliation, client parsing for device evidence. Planned: workspace metrics and message-level API-vs-client provenance.

## Data sources & access method
| Need | Source | Access | Status |
|---|---|---|---|
| Enterprise audit log (actions, actor, app context, user agent, IP, entity) | Slack Audit Logs API, ingested by the SIEM (your Slack audit collector's source category) | Search Job API preset | shipped |
| Org member roster (active, deactivated, guests, bots) | `admin.users.list` across the Enterprise org | Org-installed user token with `admin.users:read` + `admin.teams:read` | shipped |
| Fallback roster | `users.list` (workspace-level) | Bot token `users:read`, `users:read.email` | shipped |
| Billable-seat truth | `team.billableInfo` | Requires the `admin` scope; may not be granted | partial (seats inferred from membership type) |
| Workspace analytics (messages posted, active members, files) | Admin analytics export / `admin.analytics.getFile` | Org admin scope | planned |
| Message provenance (API-posted vs client-posted) | `conversations.history` metadata per message | Bot/user token with channel read scopes | planned |

Until credentials exist, an older roster export (a manually produced CSV in a system-of-record table) can be used as a snapshot. Label it as a snapshot with its date; grade anything derived from it as a LEAD, not a finding.

## Collection tactics
- Audit-log preset: extract `action`, `actor.user.email`, `context.app.name`, `context.ua` into actor / action / target / detail; keep rows with a non-blank actor. Keep the first few thousand characters of `_raw` on each event because the valuable fields (entity file title and type, IP, session id) are parsed at read time from the raw JSON rather than mapped as columns. Why: the audit schema is wide and changes; parse lazily, store once.
- Scoped backfill for a cohort (offboarding, investigation): append `| where toLowerCase(<actor field>) in ("a@…","b@…")` to the preset query and raise the cap; the list form was validated live. Actor must be a single mapped field for this to work server-side.
- Roster: pull active and deactivated members org-wide, paged; derive type (member, single-channel guest, multi-channel guest, bot, deactivated). When an org-level token is missing, fall back to the workspace bot token, then to the dated snapshot. Tombstone snapshot rows when a live pull replaces them.
- CSV import path: accept the admin console's "Export full member list" with the same columns as the snapshot table; treat an import as live for seven days, then demote to snapshot.
- Client parsing: from `context.ua`, derive platform, OS version, and client (desktop app with version, mobile app, web browser). Desktop builds identify as `Slack/<ver>` or Electron; the iOS app as its bundle id; anything else is a browser. Feed the distinct clients per person into the device-evidence signal with the IdP and EDR views.
- Planned provenance: pull `conversations.history` for in-scope channels and keep only metadata (`ts`, `user`, `bot_id`, `app_id`, presence of `client_msg_id`, `subtype`), never text. Count API-posted-as-user messages per person per day.

### Generic preset pattern (placeholders)
```
# enterprise audit log → actor / action / target(app) / detail(user agent)
_sourceCategory=<your-slack-audit-source-category>
| json field=_raw "action", "actor.user.email", "context.app.name", "context.ua"
  as action, actor, target, detail nodrop
| where !isBlank(actor)
# cohort backfill: append  | where toLowerCase(actor) in ("a@…", "b@…")  and raise the cap
```

### Roster pull modes (label every row with its mode)
| Mode | Source | Treated as | Idle measured against |
|---|---|---|---|
| live | `admin.users.list` org-wide, or `users.list` fallback | confirming evidence | now |
| import | admin console member export CSV, fresh ≤7 days | confirming evidence | import date |
| snapshot | dated roster export in the system-of-record | LEAD only, "verify first" | snapshot date |

### Client-string parsing (for device evidence)
| UA fragment | Label | Note |
|---|---|---|
| `Slack/<ver>` or Electron | Slack desktop <ver> | desktop app; OS version from the Mozilla prefix |
| iOS bundle id (`com.tinyspeck.chatlyio/<ver>`) | Slack mobile <ver> | no Mozilla prefix, no OS version |
| Android with Mozilla prefix | mobile <browser> or Slack mobile | distinguish by app marker |
| anything else with Mozilla | web browser (<name> <ver>) | weakest ownership evidence |

## Normalization & joins
Normalized events: `source: "<siem>:slack"`, actor = user email, action = audit action (for example `user_login`, `file_downloaded`, `app_installed`, tool-call actions emitted by apps), target = app name when an app is in context, detail = raw user agent. Read-time parse of `raw` yields `entity.file.title`/`filetype`, `entity.channel`, `context.ip_address`, `context.session_id`.

Joins:
- Actor email → people roster and IdP user (state, suspended, department).
- Roster member → system-of-record employee (access-reconciliation): active in Slack but gone in the system-of-record is an ACCESS-VIOLATION; active with no system-of-record record and not a guest is an ORPHAN; paid seat on a departed holder is LICENCE-BLEED.
- Client strings → device evidence per person alongside IdP `auth_context`, EDR hosts, RMM logins, password-manager sign-ins. Slack UAs are weak device ownership evidence; label them as client sightings.
- App names in `context.app.name` → an allowlist of approved apps and AI assistants.

## Signals & finding rules
| Finding | Rule | Notes |
|---|---|---|
| Unapproved app install or scope grant | `app_installed`, `app_scopes_expanded` with app not in allowlist | AI assistants and MCP bridges show up here first |
| AI tool-call provenance | Audit actions emitted by apps acting for a user (tool calls, agent actions) grouped per app and per user | Evidence that an assistant acted; pair with analysis-ai-dev-lifecycle |
| File egress burst | `file_downloaded`/`file_public_link_created` count per person per day above the person's trailing baseline | File titles are visible in `entity.file`; render blurred by default |
| Login from new client or IP | `user_login` with a UA or IP not seen for the actor in the trailing period | |
| Guest or external share growth | Roster: single-/multi-channel guests trend; shared channels | |
| API-posted-as-user message | Message with `user` set, no `bot_id`, and no `client_msg_id` | The forensic tell: official clients always attach `client_msg_id`; API posts as a user typically do not. Planned |
| Deactivated-but-present | Roster deactivated member still holding a channel or integration | |
| Seat bleed | Paid member type whose holder is gone in the system-of-record or IdP-suspended | Billing scope absent → infer from type and label as inferred |

## Analyst triage & evidence
Slack events ride the shared activity stream and the per-person fingerprint analysis (cadence, sub-second pairs, bursts, off-hours, distinct user agents). The interpretation layer must separate "automation present" from intent; API-posted messages and app tool calls are evidence of how work was done, not of wrongdoing. For investigations, the audit rail's UA, IP, session, and file titles form the covert timeline; store it in the person's assessment with the window and the sources that were empty or unavailable stated explicitly.

For access reviews, the roster snapshot with its pull mode (live / import / snapshot) and date is the evidence; findings from snapshot-only data are LEADS with a "verify first" action.

### Planned provenance work (not shipped; sequence when credentials land)
1. Request a bot token with `channels:history`, `groups:history` for the in-scope channels and `users:read`; store it like every other secret.
2. Pull `conversations.history` incrementally by `oldest`/`latest`, keeping metadata only.
3. Derive `posted_via = client | api_as_user | bot | app` from `bot_id`, `app_id`, `subtype`, and `client_msg_id` presence.
4. Roll up per user per day; add to the per-person fingerprint packet as a "tool-posted share" statistic.
5. Pull admin analytics (members active, messages posted, files shared) weekly for workspace metrics; trend, do not alert.
6. Validate the `client_msg_id` tell against a known tool-posted sample before reporting it as a marker.

### Rollout checklist
1. Confirm the Slack audit collector feeds the SIEM; probe the preset over 24 h.
2. Store the first few thousand characters of raw per event; add read-time parsers for entity and context.
3. Build the roster pull with the three modes and tombstoning; add the CSV import path.
4. Join roster to the system-of-record and IdP; grade snapshot evidence as LEAD.
5. Parse client strings into the device-evidence signal alongside IdP and EDR.
6. Add the app allowlist and the install/scope findings.
7. Render file titles and private channel names blurred by default.
8. Track the provenance and analytics items as planned, with their scope prerequisites.

## Pitfalls & lessons learned
- A roster "snapshot" that predates a suspension will show the user active. Measure idle days against the snapshot date, not now, and never confirm a finding from snapshot evidence alone.
- The `admin` billing scope may not be granted even when requested in the app manifest; detect its absence and label seat counts as inferred.
- The audit log's valuable fields live in nested `entity` and `context` objects that differ per action; map a few stable fields, keep raw, parse the rest at read time.
- Notification playbooks from the SIEM into Slack fail silently when the token lacks the chat write scope; check the SIEM's playbook error events.
- A new anomaly rule on Slack events will fire hard at first; noisy-first only works if someone owns the dial-down.
- Screen-share safety: file titles and private channel names appear in audit events; render them blurred with an explicit reveal, never hidden (presence must stay visible).
- Provenance by `client_msg_id` is a strong but not perfect tell; some official surfaces and integrations vary. Treat it as a marker to confirm, not a verdict.

## Do not
- Do not ingest message text. Provenance and metrics need metadata only.
- Do not treat Slack user agents as proof of device ownership.
- Do not confirm access violations from a months-old roster export.
- Do not store bot or user tokens anywhere but the environment or secret manager.
- Do not write to Slack from the control-plane; link to the admin console for deactivation.
- Do not claim the provenance or analytics work is live until the token scopes and pulls exist; label it planned.

## Related steering files
- monitoring-sumologic — SIEM preset pattern, scoped backfill, search client
- access-reconciliation — roster pull modes, violation/orphan/bleed rules, LEAD grading
- analysis-actor-automation-fingerprints — cadence and UA analysis over Slack events
- analysis-ai-dev-lifecycle — AI assistant provenance expectations
- access-identity-lifecycle — offboarding ties and departed-user checks
- foundation-privacy-safety-secrets — blur-by-default rendering, metadata-only collection
- foundation-evidence-datasets-snapshots — snapshot mode labelling and dated evidence
