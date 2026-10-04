---
title: SSO Adoption Metrics — director strip from identity-provider sign-on activity
category: analysis
system: JumpCloud SSO + Directory Insights
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, monitoring-jumpcloud, access-identity-lifecycle, access-groups, access-reconciliation, analysis-edr-coverage]
---
# SSO Adoption Metrics — director strip from identity-provider sign-on activity

## Why this matters
An application inventory with bindings tells you who *could* sign in. Leadership asks
different questions: what share of the workforce actually uses SSO, how much of it is
behind MFA and on managed devices, which apps are dead, where licences are bound but
unused, and whether anyone is logging in from somewhere unexpected — each with "versus
last month". Those answers live in the identity provider's **sign-on activity feed**, not
in its application list.

The control-plane backfills the activity feed to its retention horizon, keeps it
incrementally, and computes a director-level strip with prior-window deltas, a leads list
(what to act on), per-app activity, snapshots and an analyst brief. The same feed is the
cheapest cross-application **device-trust signal** available: a login that came through a
managed device carries the device in its auth context.

## Data sources & access method
| Source | Method | Yields |
|---|---|---|
| Directory Insights events | `POST insights/directory/v1/events` `{service:["sso"], start_time, end_time, limit:1000, sort:"DESC", search_after?}`; cursor in the `x-search_after` **response header** (JSON array); `x-result-count` per page | `sso_auth` events |
| Application inventory | console API apps, per-app associations (user groups, users), user groups | bindings, connector type, IdP certificate expiry (secrets redacted before storage) |
| Directory users + group membership | identities and groups syncs | adoption denominator, group-expanded bindings |
| Offboarding cohorts (read-only) | local table | lead rows link to the person's offboarding view when present |

One API key with the Directory Insights read scope. Tenant retention is ~90 days; the
first sync backfills 90 d, later syncs resume from max stored timestamp minus 2 h with
insert-or-ignore by event id. Cap pages (e.g., 200) to stop a runaway cursor; a mid-run
HTTP error keeps stored pages and records the run as `error`.

## Collection tactics
- **Event → row mapping** (store these columns; cap `raw` at a few KB):
  `id, timestamp, success (null on every sso_auth), sso_token_success, idp_initiated, mfa,
  mfa_meta.type, application.{id, display_label, name}, initiated_by.{id, username,
  administrator}, jc_initiated_by_email, client_ip, geoip.{country, city, region,
  timezone}, asn.organization, useragent.{os, name, device}, auth_context.system.{id,
  hostname}, auth_context.auth_methods, auth_context.policies_applied[], error_message`.
- **The email lives in a top-level field**, not inside `initiated_by`; a fraction of older
  events have none — fill from the users mirror by user id at read time.
- `application.name` is the **connector type** (saml2, oidc, aws-sso, google…);
  `display_label` is the app. Join `application.id` to the inventory.
- `managed = 1` when `auth_context.system` is present (a managed device asserted itself via
  device trust). Promote `policies_applied[].metadata` into `policy_conditions`
  (MANAGED_DEVICE, IP_ADDRESS) and `policy_action` = worst of DENY > ALLOW_WITH_MFA > ALLOW.
- Promote `error_message` to a column; backfill with a JSON extract when adding it later.
- Run apps pull then activity pull sequentially from one button; register both in the
  home freshness panel.

## Normalization & joins
**Event semantics (load-bearing — measure them on your own backfill):**
| `sso_token_success` | `error_message` | Meaning |
|---|---|---|
| true | — | **login** (successful assertion) |
| false | present | **failure** (authentication failed, policy denied, not authorized, internal error, invalid session, app unreachable, user denied) |
| false | absent | **MFA step** — the challenge of a login that completes later; neither login nor failure, excluded from every rate |

Every rate (MFA %, managed %, geo, utilisation, off-hours) is over **logins**; report
`events` and `mfa_steps` alongside so totals reconcile.

- **Adoption %** = distinct SSO login users ÷ activated, non-suspended directory users.
- **Bound users per app** = direct user bindings ∪ expansion of bound groups through the
  group-membership mirror.
- **Utilisation** = active users ÷ bound users per app; **bound-but-unused (90d)** =
  bound users with no login to that app in 90 d (licence-reclaim leads).
- **Dead app** = active in inventory, emits events (bookmarks never do), and no login in 30
  d / 90 d. If the first stored event is newer than the 90-day mark, label dead-90d "since
  <first event>".
- **Unexpected country** relative to a configured expected set; **multi-country user** =
  logins from ≥2 countries within 24 h (a heuristic, labelled as such).
- **Off-hours** by the event's own timezone, with a fallback.
- **Prior-window delta** for every metric: same length window immediately before; null
  when the prior window has no coverage.

## Signals & finding rules
Director strip (each tile = metric, prior value, delta, good-direction colour; tiles double
as leads filters):
| Metric | Definition | Good direction |
|---|---|---|
| SSO adoption % | distinct login users ÷ eligible users | up |
| Logins / day | logins ÷ window days | context |
| Apps in use vs dead | apps with ≥1 login vs dead-30d (and dead-90d) | dead down |
| MFA % | logins with `mfa = true` ÷ logins | up |
| Managed-device % | logins with `auth_context.system` ÷ logins; also distinct users with any unmanaged login | up |
| Unexpected-country logins | logins from countries outside the expected set | down |
| Bound-but-unused users (90d) | per app and distinct overall | down |
| Failures by reason | `token_success = false` with `error_message`, grouped; policy denies separately | context |

Leads list (every row deep-links to the person's identity view and, when in an offboarding
cohort, to that cohort):
| Lead | Rule |
|---|---|
| dead-app | no logins in 30 d (days dead, bound users, cert expiry) |
| bound-unused | app with unused bound users in 90 d |
| unmanaged-user | top users by unmanaged logins |
| no-mfa-user | users with `mfa = false` logins |
| unexpected-geo | event with country outside the expected set (full IP kept; the page is local) |
| multi-country | user with ≥2 countries in 24 h |

Per-app drawer: daily logins with managed share, top users, countries, unmanaged logins
(capped), policies seen (name · action · conditions), MFA methods, device hostnames seen,
failures by reason.

## Analyst triage & evidence
- **Analyst default**: "SecOps analyst — SSO posture and adoption evidence (director
  brief)". Contract: one headline sentence (adoption % + direction), ≤6 facts ≤18 words,
  "Since last report" from the snapshot diff, Triage with **RETIRE / RECERTIFY /
  ENFORCE-MFA / ENFORCE-DEVICE-TRUST / INVESTIGATE / EXPECTED** for every lead, ≤3 next
  steps, a Gaps line.
- **Dataset**: collections `apps` (inventory + activity fields) and `leads` (`dead-app:` /
  `bound-unused:` / `unmanaged-user:` / `no-mfa-user:` / `unexpected-geo:<user>:<CC>` /
  `multi-country:` keys with a `risk` rank), metrics = the director numbers plus
  `by_country.*`, `failures.*`, `conditions.*`; volatile `last_login`, `first_login`,
  `trend7`; headline `sso_adoption_pct`, `mfa_pct`, `managed_device_pct`, `apps_dead_30d`,
  `unexpected_country_logins`, `bound_but_unused_users_90d`.
- **Caveats travel with every export** (`context.caveats`): managed = device-trust context
  present, absent ≠ BYOD; bookmarks emit no events; retention horizon; login/failure/MFA-step
  semantics; expected-country set is configured; multi-country is a 24 h heuristic.
- Charts: inline SVG bars and sparklines only, colours from the app's tokens.

## Pitfalls & lessons learned
- `success` is null on every sso_auth event; using it yields zero logins. Use
  `sso_token_success` with the error-message split.
- Counting `token_success = false` without `error_message` as failures roughly doubles the
  failure rate — they are MFA challenge steps.
- Field names containing `token_` are dropped by a secrets sanitizer; fold
  `sso_token_success` into logins/failures rather than emitting it.
- Directory Insights wants `search_term` string values ("false"), not booleans, or it
  returns HTTP 400.
- `raw`, `policies_json` and `auth_methods` must never reach dataset entities.
- Reuse `auth_context` in offboarding (per-person unmanaged SSO logins) and EDR coverage
  rather than building new collectors.

## Do not
- Do not treat a missing `auth_context.system` as proof of a personal device.
- Do not include bookmark apps in dead-app, utilisation or bound-unused logic.
- Do not compute any rate over events; compute over logins.
- Do not store application secrets/certificates — redact before storage.
- Do not export IPs or `raw` beyond the local page; geo leads in exports carry country and
  city only if policy allows.
- Do not report deltas when the prior window predates stored coverage.

## Related steering files
- monitoring-jumpcloud — connector, Directory Insights paging, scopes
- access-identity-lifecycle — eligible users, suspended status, offboarding cohorts
- access-groups — group membership used for binding expansion
- access-reconciliation — licence bleed across SaaS joins to bound-but-unused
- analysis-edr-coverage — consumer of the managed-device signal
- foundation-evidence-datasets-snapshots — snapshot diff feeding "Since last report"
