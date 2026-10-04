---
title: SIEM Insights Triage Workbench — Cloud SIEM + DLP in One Bench
category: monitoring
system: Sumo Logic Cloud SIEM (CSE API /sec/v1), CrowdStrike Falcon Data Protection (via SIEM search)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-ai-analyst-triage, foundation-evidence-datasets-snapshots, foundation-privacy-safety-secrets, monitoring-sumologic, monitoring-crowdstrike, access-identity-lifecycle, analysis-issue-escalations]
---
# SIEM Insights Triage Workbench — Cloud SIEM + DLP in One Bench

## Why this matters
Detections that sit in a vendor console get triaged in weekly batches: closures cluster into a few minutes on one weekday, the oldest open item ages for days, and the one alert that mattered waits a week. A local triage workbench fixes the cadence problem by making the queue a first-class view the team opens every day, by anchoring every insight to a known identity, and by letting an analyst (human or AI) leave a verdict with its reasoning attached. Pulling a second detection source (endpoint DLP) into the same bench means one queue, one vocabulary, one evidence trail, instead of a second console nobody checks.

The bench also produces the closure and backlog metrics auditors ask for: open count, unassigned count, oldest open age, time-to-close distribution, and closures by resolution.

## Data sources & access method
Same Basic-auth credentials as the Search Job client (monitoring-sumologic). Cloud SIEM endpoints live under `{endpoint}/sec/v1/*`.

| Need | Endpoint / query | Notes |
|---|---|---|
| Open insights | `GET /sec/v1/insights/all?q=-status:"closed"&expand=signals` paged by `offset`/`limit` (100) | Open list is always complete |
| Recently closed insights | `GET /sec/v1/insights/all?q=status:"closed" created:>{cutoff}` | 14-day lookback so recent dismissals stay visible for context |
| Vendor AI triage verdict | `GET /sec/v1/insights/{id}/triage` | Returns `verdict`, `recommendation{severity,accepted}`, `keyEvidences[]` with `signalAnalyses[]`; 404 when none |
| Request vendor AI investigation | `POST /sec/v1/insights/{id}/investigate` | Flips verdict to `IN_PROGRESS`; results land tens of minutes later |
| Comment on an insight | `POST /sec/v1/insights/{id}/comments` | Audit-trail write |
| Close an insight | `PUT /sec/v1/insights/{id}/status` with `{status:"closed", resolution}` | Resolutions: False Positive, No Action, Resolved, Duplicate |
| Falcon Data Protection detections | Search Job over the EDR event-stream source category for `DataProtectionDetectionSummaryEvent`, 30-day window, messages mode | Parse `_raw` in code, not in the query |
| Analyst actions in the SIEM | `_index=sumologic_audit_events` filtered to insight/CSE events | Who closed what, when (the team-activity rail) |

The vendor's natural-language SOC chat has no public API; the triage/investigate endpoints are the programmable AI surface. Treat that as a design constraint.

## Collection tactics
- Sync open + recently-closed on every click. Dedupe by id (an insight closing mid-sync appears in both lists). Snapshot into one `insights` table with first-seen/last-seen/gone-at lifecycle columns. Use a full sweep so rows that stop coming back (old closures ageing out, upstream deletions) get `gone_at` stamped; because the open list is always complete, an open insight never goes "gone" spuriously.
- Scope the sweep by source. The DLP queue lives in the same table with `source='falcon-dlp'`; the CSE sweep must be restricted to non-DLP rows or it will tombstone every DLP detection on every sync. Give the snapshot helper a `sweepWhere` parameter.
- Trim signals before storing: keep id, name, severity, stage, timestamp, content type, record count, a short description. Never store the full record payloads (they can be megabytes). Store the insight `raw` without `signals`, capped.
- Prefer the vendor's generated narrative (`summary`) as triage context; fold it under the rule description. It is the best free text the API returns.
- Pick a primary entity defensively. The list endpoint carries `involvedEntities[]` only (no `entity`): prefer an email-shaped username, then any username, then a hostname, then the first entity. Store the whole entity list too.
- DLP detections: one row per `CompositeId`; `readable_id` = `DLP-` plus a short egress id; `name` = detection name → destination; `description` = vendor description + each detected indicator with its explanation + files/volume/session/destination URL; `severity` from `SeverityName`; entities = username, hostname, destination URL, destination name; tags = tactic, technique id, detection type, channel. Build `raw` as a JSON object with the two indicator lists capped, never as a string slice (a slice can cut mid-value and silently lose the deep link).
- DLP status preservation: there is no vendor write-back, so a locally closed detection must not reopen on the next sync. Before upsert, drop `status`/`resolution`/`closed_at`/`closed_by` from any row the bench already closed; absent columns stay untouched. Run DLP with `fullSweep: false` because the 30-day window is a rolling slice.
- Run the main sync as CSE then DLP, sequentially, with the DLP failure recorded alongside rather than failing the CSE run. Keep a standalone DLP-only sync route. Record every run in a runs table with a `source` column.
- Refresh vendor AI verdicts for the open set inside every sync (small set, a few concurrent GETs) and also as a standalone route to pull finished investigations. Skip DLP rows; the vendor has no insight to ask about.

### Sync lifecycle (pseudo-code)
```
sync():
  open   = fetchInsights('-status:"closed"')                       # paged, expand=signals
  closed = fetchInsights('status:"closed" created:>' + cutoff14d)
  rows   = dedupeById(open + closed).map(insightRow)              # trim signals, slim raw
  applyAssetSnapshot("insights", key=["id"], rows,
                     fullSweep=true, sweepWhere="source IS NULL OR source != 'falcon-dlp'")
  try refreshVendorAiVerdicts(openIds)  # never fails the sync
  recordRun(source=null, counts, status)

syncDlp():
  msgs = searchJob(query=DLP_EVENT_FILTER, window=30d, mode="messages", cap)
  rows = msgs.map(parseRaw).map(dlpRow).filter(nonNull)
  for r in rows where locallyClosed(r.id): drop status, resolution, closed_at, closed_by
  applyAssetSnapshot("insights", key=["id"], rows, fullSweep=false)
  recordRun(source="falcon-dlp", counts, preserved)
```

### DLP detection → bench row
| Bench column | DLP event field |
|---|---|
| `id` | `CompositeId` |
| `readable_id` | `DLP-` + first 8 chars of `EgressEventId` |
| `name` | `Name` → destination (`WebLocationName` or hostname) |
| `description` | `Description` + detected indicators with explanations + files/volume/session/URL |
| `severity` | `SeverityName` uppercased |
| `entities_json` | username, hostname, destination URL, destination name |
| `tags_json` | `dlp`, `Tactic`, `TechniqueId`, `DetectionType`, `DestinationV2.Channel` |
| `signals_json` | detected indicators (name, type, entity, score, explanation) + file-category counts |
| `record_count` | `FilesEgressedCount` |
| `created` | `metadata.eventCreationTime` |

## Normalization & joins
Columns worth having on every row regardless of source: `id`, `readable_id`, `name`, `description`, `severity` (uppercased), `confidence`, `status` (lowercased), `resolution`, `assignee`, `entity_type`, `entity_value`, `entity_hostname`, `entity_username`, `entities_json`, `source`, `tags_json`, `signal_count`, `record_count`, `signals_json`, `created`, `last_updated`, `closed_at`, `closed_by`, `raw`.

Workbench columns the sync never writes: `analyst_notes`, `triage_json`/`triaged_at`/`triage_model` (your own AI triage), `sumo_ai_verdict`/`sumo_ai_json`/`sumo_ai_fetched_at`/`sumo_ai_requested_at` (vendor AI, kept in separate columns so the two opinions stay independently pluggable), `dismissed_via`, `close_note`, `jira_key`/`jira_url`/`jira_filed_at`.

Identity anchor at read time: match `entity_username`, `entity_value`, `entity_hostname`, and every `_username` entity against the IdP user table by email, by username, and by the bare local-part of an email. Attach the IdP record (state, suspended, MFA status, admin role, department, title) to the insight so the drawer shows who this is without a per-row fetch. DLP actors are bare OS usernames; when usernames equal email local-parts in your tenant, the same anchor works.

## Signals & finding rules
| Metric / finding | Definition |
|---|---|
| Backlog | Open insights, split by severity and by `source` |
| Unassigned | Open with no `assignee` — the staffing tell |
| Oldest open age | `now - created` of the oldest open; trend it |
| Triage cadence | Distribution of `closed_at` by weekday/hour; a single weekly spike is a finding |
| Time-to-close | `closed_at - created` median and p90 per severity and per resolution |
| Closures by resolution | False Positive vs No Action vs Resolved vs Duplicate; a rule whose closures are all False Positive is a tuning candidate |
| Noisy rule | Rule name with the most open insights in the window and zero triaged |
| Dismissible | Open rows whose local AI triage says `dismissible: true` — the one-click review queue |
| Vendor AI done / in progress / not investigated | Counts over open CSE rows only |
| DLP tripwire | Any DLP detection; the rail should be near-silent, so each deserves a look |
| Identity mismatch | Insight entity resolves to a suspended or departed IdP user — correlate with offboarding |

## Analyst triage & evidence
Three verdicts can coexist on one row and must stay separable: the human's notes and resolution, your own AI triage (`triage_json`, pluggable persona), and the vendor's AI triage (`sumo_ai_*`). Render all three; never merge them into one field.

Write-backs are the only mutations the control-plane sends to the SIEM, and each is a deliberate per-insight user action: post the audit comment first (analysis text or AI verdict, so the trail shows why), then close with a resolution, then mirror locally with `dismissed_via` set. For DLP rows, the same action closes locally and appends a timestamped line to `close_note` (append-only; never to `analyst_notes`, which the analyst may overwrite).

Filing to the ticketing system records `jira_key`/`jira_url`/`jira_filed_at` on the row so the queue shows what is already escalated (see analysis-issue-escalations).

Evidence packet for the analyst persona: open rows with trimmed signals, identity anchor, both AI verdicts, backlog metrics, and the since-last-report delta. Verdict vocabulary: DISMISS / ESCALATE / WATCH / INVESTIGATE, one per row; "anomalous" is never "malicious".

### Backlog and closure metrics (pseudo-SQL over the local table)
```
-- backlog by severity and source
SELECT source, severity, count(*) FROM insights
WHERE gone_at IS NULL AND status != 'closed' GROUP BY 1,2;

-- unassigned and oldest open
SELECT count(*) FILTER (WHERE assignee IS NULL), min(created) FROM insights
WHERE gone_at IS NULL AND status != 'closed';

-- time-to-close (hours) by resolution, last 90 days
SELECT resolution, percentile_cont(0.5) WITHIN GROUP (ORDER BY hours), percentile_cont(0.9) ...
FROM (SELECT resolution, extract(epoch FROM closed_at - created)/3600 AS hours
      FROM insights WHERE closed_at > now() - interval '90 days') t GROUP BY 1;

-- triage cadence: closures by weekday and hour (a single weekly spike is the finding)
SELECT extract(dow FROM closed_at), extract(hour FROM closed_at), count(*) ... GROUP BY 1,2;

-- noisiest untriaged rule
SELECT name, count(*) FROM insights
WHERE status != 'closed' AND triage_json IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
```
Report these as a dated section in the quarterly evidence packet together with the rule count enabled and the collector health summary (monitoring-sumologic).

### Rollout checklist
1. Reuse the SIEM credentials; confirm the CSE base path works with a single `GET /insights/all?limit=1`.
2. Create the `insights` table with lifecycle columns and the workbench columns listed above; add `source` on day one.
3. Build the CSE sync with sweep scoping and the runs table; render the queue sorted open-first, severity, created.
4. Add the identity anchor at read time against the IdP user table.
5. Add write-backs as explicit buttons: comment, close with resolution, request vendor investigation; mirror locally.
6. Add the DLP sync through the SIEM search path with status preservation and local close.
7. Add your own AI triage persona in its own columns; keep the vendor verdict separate.
8. Add the backlog metrics and a since-last-report delta; snapshot the dataset on export.

## Pitfalls & lessons learned
- The vendor list API intermittently errors when a `sort` parameter is supplied; retry without it.
- The `status` field arrives as either a string or an object (`{name, displayName}`); normalize defensively.
- A guard on the number of pages (a few thousand insights) stops a runaway cursor.
- Playbook notifications (insight → chat) fail silently when the chat integration token lacks the write scope. Check the playbook error events in the system-events index; a bench that nobody is notified to open is still a weekly batch.
- Noisy-first rules are fine only if the dial-down loop is staffed. Make "open insights per rule, zero triaged" a visible number.
- Expect a second detection source to need a `source` column from day one; retrofitting the sweep scope is painful.
- The EDR event stream carries other event types (console audit v3 events, for example) that nothing ingests yet; note the gap in the packet rather than pretending coverage.

## Do not
- Do not write to the SIEM from a sync. Mutations are per-insight user actions only.
- Do not close a DLP detection upstream; no API exists. Close locally and say so in the UI.
- Do not overwrite the analyst's free-text notes with system-generated audit lines.
- Do not store full signal record payloads or the raw log lines behind them.
- Do not let the CSE full sweep touch rows from another source.
- Do not let the vendor AI verdict and your own AI triage share a column.
- Do not report "configured" as anything more than whether keys are set.

## Related steering files
- monitoring-sumologic — shared Search Job client, SIEM self-oversight rails
- monitoring-crowdstrike — the direct Falcon connector and why DLP comes through the SIEM instead
- foundation-ai-analyst-triage — pluggable triage persona, evidence packets, stored reports
- foundation-evidence-datasets-snapshots — export/snapshot/delta for the insights dataset
- foundation-privacy-safety-secrets — raw caps, redaction, local-only dismissal audit trail
- access-identity-lifecycle — the IdP user table the identity anchor joins to
- analysis-issue-escalations — ticket filing and escalation health on filed insights
