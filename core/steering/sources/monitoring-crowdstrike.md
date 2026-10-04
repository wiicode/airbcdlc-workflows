---
title: CrowdStrike Falcon — Console, Auth and API Oversight of the EDR Admin Plane
category: monitoring
system: CrowdStrike Falcon (Event Streams API, Hosts API), Falcon Data Protection via SIEM
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-privacy-safety-secrets, foundation-ai-analyst-triage, monitoring-sumologic, monitoring-siem-insights-triage, analysis-edr-coverage, analysis-endpoint-fleet-inventory, analysis-actor-automation-fingerprints]
---
# CrowdStrike Falcon — Console, Auth and API Oversight of the EDR Admin Plane

## Why this matters
The EDR console is a privileged admin plane: whoever can log in can disable prevention policies, exempt hosts, create API clients, and delete detections. Most teams watch what the sensor says about endpoints and never watch what humans and tokens do to the console. Oversight of the admin plane answers three questions continuously: who signed in and from where, what did they change, and which API clients are hammering the tenant with what scopes. A fourth question, "is the data-protection layer actually firing", rides the same event stream but needs a different collection path.

## Data sources & access method
| Need | Source | Access |
|---|---|---|
| Console user actions | `UserActivityAuditEvent` on the Event Streams feed | OAuth2 client credentials; API client scope "Event Streams: read" |
| Console and API authentication | `AuthActivityAuditEvent` on the same feed | Same |
| Every REST call made to the tenant | `APIActivityAuditEvent` on the same feed (overwhelming share of the feed, almost entirely your own integrations) | Same |
| Data Protection (DLP) detections | `DataProtectionDetectionSummaryEvent`, also on the feed, but collected via the SIEM that already ingests the stream | Search Job API (monitoring-sumologic) |
| Live host inventory, sensor freshness, prevention policies | Hosts API (`/devices/queries/devices-scroll/v1`, `/devices/entities/devices/v2`) | Scope "Hosts: read"; shared with analysis-edr-coverage |

Event Streams model: `GET /sensors/entities/datafeed/v2?appId=<stable-id>` returns a `dataFeedURL` and a short-lived `sessionToken`. Open the URL with `Authorization: Token <sessionToken>` and read newline-delimited JSON; each object has `metadata.offset`, `metadata.eventType`, `metadata.eventCreationTime` and an `event` body. Keep `appId` stable across runs; a new app id is a new stream position.

## Collection tactics
- Forward-only, offset-based. CrowdStrike exposes no REST audit-query endpoint for these events. Each refresh resumes from the last saved offset, reads for a bounded time budget (around ten seconds), saves `maxOffset + 1`, and stops. It captures activity forward from when you first start polling; it cannot backfill. Run refreshes on a schedule to build coverage, and say so in the connector's config hint.
- Treat the abort at end-of-budget as the normal exit. Anything else that fails with zero events read is a real error.
- Itemize `UserActivityAuditEvent` and `AuthActivityAuditEvent`. Each becomes one normalized event: actor = `UserId` (falls back to `Attributes.APIClientID` for token calls, then audit key/values `user_name`/`user`), action = `OperationName`, target = `ServiceName`, detail = ip, success, api client, user agent, request path, scopes, elapsed time, then the remaining `AuditKeyValues` as `key=value` pairs, capped around 600 characters.
- Roll up `APIActivityAuditEvent`. Default mode accumulates per API client id: call count, method counts, top three request paths with counts, distinct user agents (first two), distinct IPs (first three), time span. Emit one `api_activity_summary` event per client per refresh with actor = client id and target = "N API calls". Why: per-call detail is near-total noise from your own integrations, would drown the human events and stall the drain inside the time budget, yet token activity must stay visible for scope review and leaked-key detection. Offer an env switch for full per-call detail when hunting.
- Promote the highest-signal fields (`user_agent`, `request_path`, `scopes`, `user_ip`) out of the key/value blob so they survive truncation and feed the automation-fingerprint analyzer; normalize spaces in the user agent so `ua=` stays one token.
- `OperationName` is literally `logged` for API events; synthesize `api_request <METHOD>` instead so the action column reads.
### Event Streams drain (pseudo-code)
```
collect():
  token  = oauth2ClientCredentials(FALCON_BASE_URL)
  feed   = GET /sensors/entities/datafeed/v2?appId=<stable-app-id>   # dataFeedURL + sessionToken
  offset = state.get("crowdstrike:offset")
  stream = GET feed.dataFeedURL?offset=<offset>  Authorization: Token <sessionToken>, abort after ~10 s
  rollups = {}
  for line in ndjson(stream) until cap:
    maxOffset = max(maxOffset, line.metadata.offset)
    if line.metadata.eventType == "APIActivityAuditEvent" and not DETAIL_MODE:
      accumulate(rollups, line); continue
    if eventType in {UserActivityAuditEvent, AuthActivityAuditEvent}: emit(mapEvent(line))
  state.set("crowdstrike:offset", maxOffset + 1)
  return itemized + summarize(rollups)        # one api_activity_summary per client
```

### Field mapping
| Normalized | Itemized audit events | API rollup |
|---|---|---|
| actor | `event.UserId`, else `Attributes.APIClientID`, else `AuditKeyValues.user_name` | API client id |
| action | `OperationName` (synthesize `api_request <METHOD>` when it is `logged`) | `api_activity_summary` |
| target | `ServiceName` | "N API calls" |
| detail | `ip=`, `success=`, `apiClient=`, `ua=`, `path=`, `scopes=`, `elapsed=`, remaining `key=value` pairs | `n=`, `methods=`, `span=`, `ua=`, `ips=`, `paths=` |
| eventTime | `metadata.eventCreationTime` ms → `UTCTimestamp` s → now | max event time in the rollup |

- Collect DLP detections through the SIEM, not the direct connector. The direct connector filters to the two audit event types; adding a third itemized type is cheap, but the SIEM already stores the stream with retention and lets you run a 30-day window on demand. Parse `DataProtectionDetectionSummaryEvent` fields: `Name`, `SeverityName`, `DetectionType`, `UserName`, `Hostname`, `DestinationV2.{Channel, WebLocationName, WebLocationHostname, WebLocationURL}`, `DataVolume`, `FilesEgressedCount`, `FileCategoryCounts[]`, `AnodeIndicators[]` (keep only `Detected: true`), `TechniqueId`, `FalconHostLink`. Feed them to the triage bench (monitoring-siem-insights-triage).

## Normalization & joins
Normalized shape `{source: "crowdstrike", eventTime, actor, action, target, detail}`. Use `metadata.eventCreationTime` (ms) first, then `event.UTCTimestamp` (s), then now.

Joins:
- Console actors are email-shaped; resolve against the people roster. API client ids resolve against a maintained map of client id → integration owner; unknown client ids are a finding.
- DLP `UserName` is a bare OS username; resolve via the IdP table by username or email local-part. `Hostname` joins to the Hosts API inventory and to the device system-of-record (analysis-edr-coverage).
- `FalconHostLink` is the deep link back to the console; carry it into detail so an analyst can pivot.

## Signals & finding rules
| Finding | Rule |
|---|---|
| Console login from unexpected geography or new user agent | `AuthActivityAuditEvent` with ip/ua not seen for that actor in the trailing period |
| Failed console authentication burst | Several `success=false` auth events for one actor within a short window |
| Policy or exclusion change | `UserActivityAuditEvent` whose `OperationName` touches prevention policy, exclusions, host groups, or sensor uninstall protection |
| API client lifecycle | Operations creating, updating, or deleting API clients or keys; new client id appears in rollups |
| Scope creep | Rollup `scopes=` for a client includes write scopes the integration is not known to need |
| Unknown API client | Rollup actor not in the client → owner map |
| Off-hours or sub-second console cadence | Feed the itemized events to the automation-fingerprint analyzer (analysis-actor-automation-fingerprints) |
| DLP detection | Any `DataProtectionDetectionSummaryEvent`; tag by channel (web upload, USB, cloud sync) and destination |
| Prevention policy disabled yet assigned | From the Hosts API: policy `enabled=false` with hosts assigned to it (cross-reference analysis-edr-coverage) |

## Analyst triage & evidence
Console and auth events land in the main activity stream with the other admin planes and are analyzed per person with the deterministic fingerprint stats plus an AI interpretation that separates "automation present" from any judgement of intent.

DLP detections are triaged in the insights bench with vocabulary DISMISS / ESCALATE / WATCH / INVESTIGATE. There is no vendor write-back for DLP detections; closures are local with an append-only audit line, and the sync preserves them. Evidence for compliance: the bench's closure record plus the DLP detection row with its indicator explanations and file-category counts (never file names; the event does not carry them).

Pair DLP detections with the outbound-mail rollup (monitoring-google-workspace) and Drive sharing events for exfiltration hunts; one source alone is rarely conclusive.

### Admin-plane review questions the evidence must answer
| Question | Evidence row(s) |
|---|---|
| Who logged into the console this week, from where, on what client? | `AuthActivityAuditEvent` itemized, grouped by actor with ip/ua |
| Did anyone weaken prevention or exclusions? | `UserActivityAuditEvent` filtered to policy/exclusion/host-group operations |
| Which integrations hold write scopes, and did a new one appear? | rollup `scopes=` and the client → owner map delta |
| Is any integration behaving unusually? | rollup `n=` and `paths=` vs the client's trailing baseline |
| Did DLP fire, for whom, to where? | DLP rows in the triage bench with channel and destination |
| Are hardened policies actually enabled on the hosts assigned to them? | Hosts API policy state (analysis-edr-coverage) |

### Rollout checklist
1. Create an API client with "Event Streams: read" (and "Hosts: read" if the coverage module shares it); store credentials in the environment or secret manager only.
2. Pick a stable `appId` and record it in the config hint; never rotate it casually.
3. Implement the drain with a short read budget, offset persistence, and the two-type itemization.
4. Add the API rollup accumulator and the env switch for detail mode.
5. Schedule refreshes (minutes to an hour apart) so the forward-only feed builds coverage.
6. Maintain the API client id → integration owner map; alert on unknown ids.
7. Add the DLP preset and bench sync through the SIEM path (monitoring-siem-insights-triage).
8. Disable (keep) the "via SIEM" console-audit preset as a documented fallback.

## Pitfalls & lessons learned
- A "via SIEM" preset for `UserActivityAuditEvent` is redundant with the direct connector once the Event Streams client works. Keep it disabled but present as a fallback for backfill if the direct connector is ever down for longer than the SIEM's retention covers.
- Stale exports are the silent killer. A nightly export of hosts to the system-of-record stopped for months while every status marker in it still rendered; the live Hosts API showed a healthy fleet. Treat any firehose/export table as a snapshot with a timestamp and grade it as a LEAD, never as live truth. Pull live state yourself.
- Prevention policies: a tenant can end up with only platform-default policies enabled while custom "hardened" policies are disabled yet still assigned to hosts. Read `enabled` and assignment separately.
- The event stream carries additional audit event types nothing ingests yet. List the gap in the analyst packet rather than implying full coverage.
- Keep `appId` stable. Rotating it resets the stream position and loses the offset chain.
- The read budget must be short enough to fit the control-plane's refresh route timeout; rely on frequent runs, not long reads.

## Do not
- Do not itemize every `APIActivityAuditEvent` by default. Roll up per client; switch to detail only for a hunt.
- Do not attribute token calls to a human. Empty `UserId` means API client; name the client id.
- Do not treat a months-old export of host status as fleet truth.
- Do not store secrets from the stream (session tokens, client secrets) in events; only ids and scopes.
- Do not claim DLP coverage from the direct connector; it comes through the SIEM path.
- Do not surface file names or content from DLP events; the event does not carry them and the analyst should not expect them.

## Related steering files
- monitoring-sumologic — the SIEM search path used for DLP detections
- monitoring-siem-insights-triage — the bench where DLP detections are triaged
- analysis-edr-coverage — device ↔ owner ↔ policy chain, sensor freshness, coverage findings
- analysis-endpoint-fleet-inventory — fleet inventory and system-of-record reconciliation
- analysis-actor-automation-fingerprints — cadence and user-agent analysis over console events
- foundation-privacy-safety-secrets — detail caps, secret redaction, local-only closures
