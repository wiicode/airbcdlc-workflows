---
title: JumpCloud — IdP Oversight, SSO Activity and Posture Snapshots
category: monitoring
system: JumpCloud (Directory Insights API, console REST API) and JumpCloud logs ingested by the SIEM
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, monitoring-sumologic, analysis-sso-adoption-metrics, access-identity-lifecycle, access-groups, access-reconciliation, analysis-edr-coverage]
---
# JumpCloud — IdP Oversight, SSO Activity and Posture Snapshots

## Why this matters
The IdP is where access is granted, revoked, locked, and federated. Three distinct views are needed and they come from different places: admin and configuration changes (who changed what), security-material user events that have no admin actor (lockouts, risk events, system-initiated suspensions), and SSO login activity for every downstream application (adoption, MFA, device trust, dead apps). A fourth view, posture, covers vendors that expose no activity log at all; for them a daily roster snapshot (MFA, admin, disabled) is the only oversight available.

## Data sources & access method
| View | Source | Access |
|---|---|---|
| Admin/config changes | IdP event logs ingested by the SIEM (your IdP collector's source category) | Search Job API, preset |
| Security-material user events with no admin actor | Same SIEM source, complementary filter | Search Job API, preset |
| SSO logins to a specific downstream app (e.g. a threat-intel vendor with no login log) | Same SIEM source filtered to SSO events for that application | Search Job API, preset |
| Org-wide SSO activity feed | Directory Insights `POST https://api.jumpcloud.com/insights/directory/v1/events` with `service:["sso"]` | `x-api-key` header; Directory Insights read scope; cursor in the `x-search_after` response header |
| Failed events, admin actors, per-user timelines | Directory Insights with `service:["all"]` and a `search_term` | Same |
| SSO application inventory, SAML/OIDC config, cert expiry, bindings | Console REST API (applications, per-app associations to users and user groups, user groups) | Console API key |
| Users and group membership | Console REST API (system users, groups, members) | Same; feeds access-identity-lifecycle and access-groups |
| Posture for vendors without logs | Vendor members/roster API (MFA, admin, disabled) | Daily snapshot |

Directory Insights is a separate base (api.jumpcloud.com) with a POST-based query, distinct from the console REST base. The API key is sent only as a header and never logged.

## Collection tactics
- Two complementary SIEM presets, never one. `admin`: extract `initiated_by.email`, `event_type`, `resource.name`; keep rows with a non-blank actor. `security`: match the material event types (`user_lockout`, `user_unlocked`, `user_suspended`, `user_activated`, `risk_event_created`, `user_admin_granted`, `user_admin_revoked`) and keep rows where `initiated_by.email` is blank; actor falls back `initiated_by.username` → `resource.username` → `resource.name` (risk events carry the user in `resource.name`); detail = `system.displayName`. The `isBlank` test makes the second preset the exact complement of the first so admin-initiated suspends and grants never double-insert. Why: a filter on non-blank actor silently dropped every system-initiated lockout until someone noticed a user's lockouts were invisible.
- SSO logins for a specific vendor: filter the IdP SIEM source to `"sso"` plus the app name, extract `initiated_by.email`, `event_type`, `application.name`. Cheapest possible login log for a product that has none.
- SSO activity feed: first run backfills the vendor's retention window (90 days), later runs resume from `max(stored timestamp) - 2h` with `INSERT OR IGNORE` by event id. Page sequentially with the `x-search_after` cursor (page 1000, sort DESC); hard-stop after a couple hundred pages so a runaway cursor cannot loop; retry 429 with `retry-after` or exponential backoff; a mid-run HTTP error keeps the pages already stored and records the run as `error`. Never throw from this module; the UI degrades.
- Failed-event probe for the identities analyst: `search_term: {and:[{success:"false"}]}` — the string, not a boolean (a boolean returns 400); re-filter on `success === false` locally.
- Admin actors: `search_term: {and:[{"initiated_by.type":"admin"}]}` over 30 days derives who acts as an admin when the admins endpoint is unreachable.
- App inventory: normalize → redact → upsert, in that order. Deep-walk every JSON value and mask the entire subtree under any key matching `/privatekey|private_key|secret|password|token|credential|api[_-]?key|passphrase|priv|signing/i`, keeping only form-field metadata (`label`, `type`, `position`, `visible`, `required`, `readOnly`, `tooltip`) so the UI can still render the field. Keep public certificates (IdP/SP certificate) and their expiry timestamps. Store `idp_cert_expires_at` and `idp_cert_updated_at` as columns.
- Bindings: pull per-app associations for both `user` and `user_group`, then expand groups through the membership table so "bound users" is a real count.
- Posture snapshot: for a vendor with no activity log, pull the members roster daily (MFA enrolled, admin role, disabled) into a dated snapshot table; grade by diff against the previous snapshot. Do not emit roster rows as events; they read like findings and clutter the stream.

### Generic preset patterns (placeholders)
```
# admin & config changes — keeps only rows with an admin actor
_sourceCategory=<your-idp-source-category>
| json field=_raw "initiated_by.email", "event_type", "resource.name" as actor, action, target nodrop
| where !isBlank(actor)

# security-material user events with NO admin actor — the exact complement
_sourceCategory=<your-idp-source-category>
  ("user_lockout" OR "user_unlocked" OR "user_suspended" OR "user_activated"
   OR "risk_event_created" OR "user_admin_granted" OR "user_admin_revoked")
| json field=_raw "event_type", "initiated_by.email", "initiated_by.username",
  "resource.username", "resource.name", "system.displayName"
  as action, ib_email, ib_user, res_user, res_name, device nodrop
| where isBlank(ib_email)
| if(isBlank(ib_user), if(isBlank(res_user), res_name, res_user), ib_user) as actor
| if(isBlank(res_user), res_name, res_user) as target

# SSO logins to one downstream app that has no login log of its own
_sourceCategory=<your-idp-source-category> "sso" "<app-name>"
| json field=_raw "initiated_by.email", "event_type", "application.name" as actor, action, target nodrop
| where !isBlank(actor)
```

### Directory Insights request shapes
```
POST https://api.jumpcloud.com/insights/directory/v1/events   x-api-key: <key>
{ "service": ["sso"], "start_time": "...", "end_time": "...", "limit": 1000, "sort": "DESC",
  "search_after": <value of previous x-search_after header, when paging> }

{ "service": ["all"], ..., "search_term": { "and": [ { "success": "false" } ] } }           # failures (string!)
{ "service": ["all"], ..., "search_term": { "and": [ { "initiated_by.type": "admin" } ] } }  # admin actors
{ "service": ["all"], ..., "search_term": { "and": [ { "initiated_by.username": "<user>" } ] } }  # one person
```

## Normalization & joins
SSO event row (one per event id): `ts`, `app_id`, `app_label` (`application.display_label`; `application.name` is the connector TYPE such as saml2/oidc/aws-sso/google), `app_type`, `user_id`, `username`, `email` (from `jc_initiated_by_email`, not `initiated_by.email`; backfill blanks from the user table by `user_id`), `is_admin`, `success` (null on every `sso_auth`), `token_success` (`sso_token_success`), `idp_initiated`, `mfa`, `mfa_method` (`mfa_meta.type`: totp, webauthn, device-trust client, push), `country`, `city`, `region`, `timezone` (drives off-hours), `ip`, `asn_org`, `os`, `browser`, `device`, `managed` (1 when `auth_context.system` is present), `system_id`, `system_hostname`, `auth_methods` (comma list with `:fail` suffix), `policies_json`, `policy_conditions` (union of `policies_applied[].metadata.conditions`, e.g. MANAGED_DEVICE, IP_ADDRESS), `policy_action` (worst of DENY > ALLOW_WITH_MFA > ALLOW), `error_message`, `raw` capped at a few thousand chars.

Event semantics, measured on the backfill:

| `sso_token_success` | `error_message` | Meaning |
|---|---|---|
| true | — | login (successful assertion) |
| false | present | failure (authentication failed, policy denied, not authorized, internal error, invalid session) |
| false | absent | MFA challenge step of a login that completes later; neither a login nor a failure; excluded from every rate |

Joins: `app_id` → application inventory; `user_id`/`email` → users table (adoption denominator = activated, non-suspended users); bindings + group expansion → utilisation; `system_id`/`system_hostname` → managed-device inventory (analysis-edr-coverage); email → offboarding cohorts.

## Signals & finding rules
| Finding | Rule |
|---|---|
| Admin change without ticket | `admin` preset event on roles, policies, SSO apps, API keys |
| Lockout / unlock / risk event | `security` preset; cluster by user and device |
| Admin grant with no admin actor | `user_admin_granted` with blank `initiated_by.email` — investigate how |
| SSO adoption % | distinct SSO users ÷ activated non-suspended users, with prior-window delta |
| MFA % | logins with `mfa=true` ÷ logins |
| Managed-device context % | logins with `managed=1` ÷ logins; `auth_context.system` + `policies_applied` conditions are the conditional-access evidence |
| Dead app | app with no login in 30 d (and 90 d); exclude bookmark apps, which never emit `sso_auth` |
| Bound but unused | user bound (directly or via group) with no login in 90 d — licence lead |
| Unexpected country | login country not in the configured expected set; multi-country within 24 h is a weak heuristic |
| No-MFA logins | users with `mfa=false` logins, ranked |
| Failures by reason | `error_message` grouped; policy denies separated |
| Cert expiry | `idp_cert_expires_at` within 60 d |
| Posture drift | roster diff: new admin, MFA disabled, re-enabled account |

## Analyst triage & evidence
Director brief contract: one headline sentence (adoption % and direction), ≤6 facts of ≤18 words, a deterministic "since last report" delta from the snapshot diff, a triage line per lead with vocabulary RETIRE / RECERTIFY / ENFORCE-MFA / ENFORCE-DEVICE-TRUST / INVESTIGATE / EXPECTED, ≤3 next steps, and a Gaps line stating retention, bookmarks emit no events, and that "unmanaged" means no managed-device context, not proof of a personal device.

Export/snapshot the dataset with `raw`, `policies_json`, and `auth_methods` kept out of exported entities; fold `sso_token_success` into logins/failures rather than exporting a token-named field (sanitizers drop token-named keys). Carry the caveats into every export and packet.

### Rollout checklist
1. Confirm the IdP log collector feeds the SIEM; probe both presets over 24 h and check the security preset returns rows the admin preset does not.
2. Confirm the Directory Insights licence covers the retention you need; a 402 means decide, not retry.
3. Build the app inventory sync with redact-before-persist and cert-expiry columns; verify no secret-named key survives by grepping the stored JSON.
4. Build the SSO event sync with 90-day backfill, incremental overlap, cursor paging, page cap, 429 retry, and a runs table.
5. Compute director metrics as pure functions over in-memory rows; unit-test the three-way event semantics and the group-expanded bindings.
6. Configure the expected-country set; review the first week of unexpected-country leads before trusting the metric.
7. Add the posture snapshot for any vendor without logs; diff daily.
8. Wire export/snapshot/analyst for the IdP dataset and hand the device-trust evidence to the EDR coverage module.

## Pitfalls & lessons learned
- Directory Insights can return HTTP 402 when the tenant's licence limits history; the collector then flaps for weeks. Make a licensing decision, do not leave it flapping.
- `success` is null on every `sso_auth` event. Build all rates on `sso_token_success` with the three-way semantics above or you will count MFA steps as failures.
- The email lives in `jc_initiated_by_email`; a meaningful share of older events have none, so fill from the users table.
- A search `limit` above the API maximum (10k) errors; clamp it.
- Redact before anything else touches the app record, including logging.
- "Managed" absent is not BYOD. Say "no managed-device context" everywhere.

## Do not
- Do not filter the security preset on a non-blank actor; the blank actor is the point.
- Do not store SAML private keys, client secrets, or tokens from app configs, even masked-by-length; mask the subtree.
- Do not count bookmark apps as dead or compute utilisation on them.
- Do not treat a single unexpected-country login as an incident; it is a lead with a configurable expected set.
- Do not emit vendor roster snapshots as events in the activity stream.
- Do not let the SSO sync throw; record the run and degrade.

## Related steering files
- analysis-sso-adoption-metrics — the director metrics math and leads in depth
- access-identity-lifecycle — users table, suspend actions, offboarding ties
- access-groups — group membership and privileged-group scrutiny
- access-reconciliation — IdP bypass and IdP gap findings across SaaS
- analysis-edr-coverage — managed-device inventory joined to SSO `auth_context`
- monitoring-sumologic — the SIEM presets and search client
- foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets
