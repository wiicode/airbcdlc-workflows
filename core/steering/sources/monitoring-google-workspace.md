---
title: Google Workspace — Drive, Gmail and Alert Center Through the SIEM
category: monitoring
system: Google Workspace (Drive audit, Gmail log export, Alert Center) ingested by Sumo Logic
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-privacy-safety-secrets, foundation-evidence-datasets-snapshots, monitoring-sumologic, monitoring-crowdstrike, monitoring-siem-insights-triage, analysis-saas-settings-baseline, access-identity-lifecycle, access-reconciliation]
---
# Google Workspace — Drive, Gmail and Alert Center Through the SIEM

## Why this matters
Alert Center alone covers roughly one event a day. The actual exfiltration surface is Drive sharing and downloads and outbound mail with attachments, and both generate enough volume that ingesting everything buries the signal and the budget. The approach that worked: itemize the few event classes an analyst must be able to answer questions about ("what did this person download the week before leaving", "who shared what externally"), roll up the high-volume read/edit and delivery noise into hourly counts per person, and deliberately leave the rest in the SIEM where it can be queried on demand. Design each rail so that anything appearing on it deserves a look.

## Data sources & access method
All three arrive through SIEM collectors; the control-plane reads them with the Search Job API (monitoring-sumologic). Each has a different shape, and the shape determines the query technique.

| Rail | Source shape | Key fact |
|---|---|---|
| Drive | Reports API activity records: `actor.email`, `ipAddress`, `events[0].name`, `events[0].type`, and a `parameters[]` list of `{name, value}` or `{name, multiValue[]}` | Document fields are inside `parameters[]`, so JSON-path cannot index by parameter name; pull them with `parse regex` |
| Gmail | BigQuery log-export shape: `event_name=delivery` on every row, fields under `gmail.message_info.*` (`source.from_header_address`, `subject`, `num_message_attachments`, `flattened_destinations`, `flattened_triggered_rule_info`, `connection_info.{is_internal, spf_pass, dkim_pass, client_ip}`, `rfc2822_message_id`, `is_spam`) | NOT the Reports API. Several rows per message (per stage, per mailbox, plus domain-level policy rows), so dedup by message id |
| Alert Center | Alert objects: `type`, `source`, `metadata.severity`, `data.maliciousEntity.fromHeader`, `data.messages[0].{recipient, subjectText}` | Low volume; itemize everything |
| User inventory | Directory snapshot stream (also in the SIEM) | Inventory, not events; deliberately not ingested as events (use the Directory API in access-reconciliation instead) |

Direct Google Admin APIs (Directory users/groups, Endpoint Management mobile devices) are a separate access path with OAuth consent and belong to the access and device files.

## Collection tactics
Drive, three presets:
- `sharing` (itemized): filter to ACL events (`acl_change`, `change_user_access`, `change_document_visibility`, `change_document_access_scope`, `change_acl_editors`, `shared_drive_membership_change`), keep `events[0].type = acl_change`. Regex-extract `doc_title`, `visibility`, `visibility_change`, `owner`, `doc_type`, `target_user`, and the first element of `new_value`/`old_value` multiValue arrays (roles such as content_manager/can_view). Detail = visibility tag, "→ target user", old→new role, visibility, doc type, owner, IP.
- `content` (itemized): keep `events[0].name` in download, upload, delete, trash, untrash, move, rename, create, copy, print, add_to_folder, remove_from_folder, change_owner. Carry `visibility` in detail so a search for `shared_externally` narrows to externally shared documents.
- `access_rollup` (records mode, hourly): reads/edits/sync (`view`, `access_url`, `access_item_content`, `edit`, `search`, `sync_item_content`, `sheets_import_range`, `preview`) → `timeslice 1h | count by _timeslice, actor, event, visibility`. Keeps read noise out of the itemized stream while preserving "who is reading externally shared docs, how much". Floor the window end to the last complete hour.
- Blank `actor.email` means a Google system caller (`actor.callerType = KEY`, `actor.key = SYSTEM`, for example cross-sheet import ranges and system deletes). Map it to `system:SYSTEM`; otherwise `anonymous`. Never drop it.

Gmail, three presets:
- `material` (itemized, tripwires only): classify each row into one of four actions and keep only rows with a class, then `dedup by msgid, action`. (1) `malware_attachment`: raw contains a malware-family field. (2) `outbound_external_attachment`: from-header is your domain AND a destination matches `/@(?!yourdomain\.tld([,;\s]|$))/` (so a look-alike subdomain of another TLD still counts as external) AND attachments > 0. (3) `rule_triggered`: a non-routine rule fired; strip routine consequences first (ROUTING catch-all and helpdesk forwards, SPAM_OVERRIDE allowlists, the content-compliance "prepend subject tag for outside mail") and test what remains for `Triggered by <TYPE> rule`; extract `rule_name` from the stripped string. (4) `domain_spoof_inbound`: from-header is your domain, mailbox ≠ sender, `is_internal=false`, SPF and DKIM both false, and a real `client_ip` exists (internal forwards have none). Actor = sender for outbound, receiving mailbox otherwise; target = destinations (strip the `type:subtype:` prefixes) or the from address.
- `outbound_rollup` (records, hourly): messages from your domain with at least one external recipient, dedup by message id, `count as msgs, sum(attachments) by _timeslice, from_addr`. This is the exfil-by-email baseline; pair with endpoint DLP.
- `spam_rollup` (records, hourly): `is_spam=true`, dedup by message id, `count by _timeslice, mailbox, from_domain`. Shows who is targeted and from where; Google already quarantined these.
- The full delivery trace (every stage of every message) is deliberately not ingested. It is orders of magnitude larger than the tripwires and answers no question an analyst asks first.

Alert Center, one preset: actor = affected recipient (resolves to a roster person), action = alert type (falls back to source), target = malicious sender header, detail = severity and subject.

Validate every new query with a scratch search-job probe over a 24-hour window before enabling the preset; the shapes are easy to get wrong.

### Query skeletons (placeholders)
```
# Drive — pull a parameter by name from the Reports API parameters[] list
_sourceCategory=<your-drive-audit-source-category> ("acl_change" OR "change_document_visibility" ...)
| json field=_raw "actor.email", "ipAddress", "events[0].name", "events[0].type" as actor, ip, ev, evtype nodrop
| json field=_raw "actor.callerType", "actor.key" as caller, akey nodrop
| if(isBlank(actor), if(caller = "KEY", concat("system:", akey), "anonymous"), actor) as actor
| parse regex field=_raw "\"name\":\s*\"doc_title\",\s*\"value\":\s*\"(?<doc_title>[^\"]*)\"" nodrop
| parse regex field=_raw "\"name\":\s*\"visibility_change\",\s*\"value\":\s*\"(?<vis_change>[^\"]*)\"" nodrop
| parse regex field=_raw "\"name\":\s*\"new_value\",\s*\"multiValue\":\s*\[\s*\"(?<new_value>[^\"]*)\"" nodrop
| where evtype = "acl_change"

# Drive — hourly rollup of reads/edits per person × action × visibility (records mode)
... | where ev in ("view", "access_url", "access_item_content", "edit", "search", "sync_item_content", "preview")
| timeslice 1h | count by _timeslice, actor, ev, visibility

# Gmail — outbound-external hourly rollup per sender (records mode)
_sourceCategory=<your-gmail-export-source-category>
| json field=_raw "gmail.message_info.source.from_header_address", "gmail.message_info.num_message_attachments",
  "gmail.message_info.flattened_destinations", "gmail.message_info.rfc2822_message_id" as from_addr, n_att, dests, msgid nodrop
| where from_addr matches "*@<yourdomain.tld>" and dests matches /@(?!<yourdomain\.tld>([,;\s]|$))/
| dedup by msgid | if(isBlank(n_att), 0, toLong(n_att)) as n_att
| timeslice 1h | count as msgs, sum(n_att) as attachments by _timeslice, from_addr

# Gmail — tripwire classifier sketch (itemized)
| if(_raw matches "*\"malware_family\":\"*", "malware_attachment", "") as c1
| if(<outbound> and !isBlank(n_att) and n_att != "0", "outbound_external_attachment", "") as c2
| replace(rules, /Triggered by (ROUTING|SPAM_OVERRIDE) rule[^\"]*/, "") as rules_x   # strip routine consequences
| if(rules_x matches /Triggered by [A-Z_]+ rule/, "rule_triggered", "") as c3
| if(<from is ours> and mailbox != from_addr and is_internal = "false" and spf = "false" and dkim = "false"
     and !isBlank(client_ip), "domain_spoof_inbound", "") as c4
| coalesce(c1, c2, c3, c4) as action | where !isBlank(action) | dedup by msgid, action
```

### Volume bands (why the split exists)
| Rail | Raw volume band | Ingested shape | Expected ingested band |
|---|---|---|---|
| Drive sharing | hundreds/day | itemized | hundreds/day |
| Drive content moves | hundreds/day | itemized | hundreds/day |
| Drive reads/edits | high hundreds to thousands/day | hourly rollup | low hundreds of rows/day |
| Gmail delivery trace | thousands/day | not ingested | 0 |
| Gmail tripwires | — | itemized | near-silent (a handful/day) |
| Gmail outbound rollup | — | hourly rollup | tens of rows/day |
| Gmail spam rollup | tens/day | hourly rollup | tens of rows/day |
| Alert Center | ~one/day | itemized | ~one/day |

## Normalization & joins
Rails are `source: "<siem>:gdrive"`, `"<siem>:gmail"`, `"<siem>:google"`. Event time comes from `_messagetime` for itemized rows and `_timeslice` for rollups; rollup detail carries `_count` (or `msgs`/`attachments`).

Joins: actor email → people roster and IdP user; `target_user` on sharing events → roster (internal) or external domain (external); `owner` → roster; destinations on outbound mail → domain allowlist (partners, vendors) vs unknown; `system:SYSTEM` → excluded from per-person baselines. Alert Center recipient → the same person record as their Gmail and Drive rows so a phishing alert, a spam spike, and a download burst line up on one timeline.

## Signals & finding rules
| Finding | Rule |
|---|---|
| External share | `visibility_change = external` or `visibility = shared_externally` on a sharing event; link-sharing (`people_with_link`) is the weaker cousin |
| Role escalation on a document | old→new role moves up (viewer → editor/content manager) for an external target |
| Download burst | `content` downloads per person per day above trailing baseline; escalate when the documents were externally shared |
| Ownership transfer out | `change_owner` to a target outside the roster |
| Outbound attachment to unknown domain | `outbound_external_attachment` where destination domain is not allowlisted |
| Outbound volume anomaly | `outbound_rollup` msgs or attachments per sender per day above baseline; strongest when the sender is in an offboarding cohort |
| Spoof of own domain | any `domain_spoof_inbound` |
| Malware attachment | any `malware_attachment` |
| Non-routine rule hit | `rule_triggered` with a rule name not in the routine list |
| Targeted mailbox | `spam_rollup` concentration on one mailbox or from one domain |
| Phishing alert | any Alert Center row; user-reported phishing counts as positive culture evidence |

## Analyst triage & evidence
These rails feed per-person signals rather than a dedicated triage queue: each becomes one Signal with `ok` / `empty` / `unavailable` status in an exfiltration assessment, scored deterministically with the other sources (Slack, IdP, source control, endpoint DLP, password manager), and then narrated tersely by an AI persona. State explicitly in the UI and the prompts what is not observable: Gmail forwarding rules, Chrome managed profiles, and anything before the collector's first day of history.

Evidence for compliance: the per-person report with window, sources consulted, empty sources, and the itemized rows behind each flagged signal. Render document titles and subjects blurred by default with an explicit reveal.

### Rollout checklist
1. Confirm which collector shape you have for Gmail (Reports API vs BigQuery export) by reading three raw rows; the whole preset design depends on it.
2. Probe each Drive preset over 24 h; confirm `doc_title` and `visibility` extract on real rows and that blank actors map to the system caller.
3. Enable `sharing` and `content` itemized; watch the stream for a day to tune the event-name lists.
4. Enable the Drive hourly rollup with window flooring; check that no row re-inserts with a different count on the next refresh.
5. Build the Gmail tripwire classifier; list your routine rules and strip them per consequence; verify the rail is near-silent.
6. Enable the outbound and spam rollups; set the domain allowlist for partners.
7. Add Alert Center; map recipients to the roster.
8. Record the first-event timestamp per rail and surface it as a coverage caveat in every per-person report.

## Pitfalls & lessons learned
- History starts when the collector starts. A new Drive or Gmail collector has nothing before its first day; pre-event evidence for a cohort that left earlier does not exist. Record the first-event timestamp and say so.
- Treat Gmail as the BigQuery export shape, not the Reports API; the field paths and the per-stage row multiplicity are different and `dedup by rfc2822_message_id` is mandatory.
- "Outbound" is from-header-is-ours and a recipient is not; `mailbox = from_addr` is not the test (domain-level policy rows and multi-recipient rows break it).
- Routine rules must be stripped per consequence, not per message; a message that trips both the routine subject tag and a real rule must still surface.
- The spoof class needs a real SMTP `client_ip`; without that condition internal forwards look like spoofs.
- Reports API parameters are a list; JSON-path cannot address them by name. Regex on `"name":"doc_title","value":"…"` works; keep the patterns `nodrop`.
- The user-inventory stream is snapshots, not events; ingesting it as events floods the stream with non-activity.
- Partial-hour rollups re-insert with different counts; floor the window.

## Do not
- Do not ingest the full Gmail delivery trace or message bodies; tripwires and rollups only.
- Do not drop blank-actor Drive events; map them to the system caller.
- Do not treat link-sharing as equivalent to external sharing; tag them differently.
- Do not infer intent from a download burst; it is a lead to confirm with HR/legal involvement.
- Do not store subjects or document titles in exports without the same blur-by-default handling the UI applies.
- Do not claim coverage before the collector's first event.

## Related steering files
- monitoring-sumologic — search client, preset config, hourly-rollup flooring, credit control
- monitoring-crowdstrike — endpoint DLP detections to pair with outbound mail and Drive egress
- monitoring-siem-insights-triage — where DLP detections are triaged
- analysis-saas-settings-baseline — Workspace admin settings evaluation against a checklist
- access-identity-lifecycle — offboarding cohorts and departed-user windows
- access-reconciliation — Directory API roster pull and licence findings
- foundation-privacy-safety-secrets — blur-by-default, metadata-only, raw caps
- foundation-evidence-datasets-snapshots — per-person report storage and dated evidence
