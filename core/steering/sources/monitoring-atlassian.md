---
title: Atlassian — org audit log plus SIEM webhook events
category: monitoring
system: Atlassian (Jira Cloud, Confluence Cloud, Atlassian Administration)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, monitoring-sumologic, access-atlassian, access-reconciliation, access-identity-lifecycle, analysis-issue-escalations, analysis-actor-automation-fingerprints]
---
# Atlassian — org audit log plus SIEM webhook events

## Why this matters
Jira and Confluence hold the engineering backlog, incident write-ups, runbooks, and
customer-facing docs. The in-product audit trail is gated by license tier: on lower tiers
you see admin actions and little else, and the Jira project-level audit UI is almost
useless for security oversight. Yet the questions keep coming — who exported that project,
who changed page restrictions, who made a space public, is a departing engineer bulk-
reading or exporting content in their last week.

The control-plane answers these with two complementary feeds:
1. **The organization audit-log API** (Atlassian Administration) — the workaround for the
   license gap. It covers org-level admin actions on any tier and, on higher tiers,
   user-created activity events.
2. **Product webhooks ingested by the SIEM** — sprint lifecycle, content permission
   changes, page operations. These are product-level events the org log never carries.

Neither feed alone is sufficient; together they cover admin plane + content plane.

## Data sources & access method
| Feed | Endpoint / path | Auth | Scope |
|---|---|---|---|
| Org audit log | `GET https://api.atlassian.com/admin/v1/orgs/{orgId}/events?from=&to=&cursor=` | Org admin API key (Bearer) created in Atlassian Administration → Settings → API keys | Admin actions all tiers; user activity on Premium/Enterprise |
| Jira webhooks → SIEM | Product webhook (sprint, issue, project events) posted to an HTTP source | Webhook secret | Sprint lifecycle, issue events you subscribe to |
| Confluence webhooks → SIEM | Product webhook (`eventType`, user display name, content) | Webhook secret | Page create/update/remove, permission changes, space events |
| Seat/role posture | Org users + product access (see access-atlassian) | Same org key | Who CAN; not covered here |

Store the org id and key in the secret manager; the connector only needs them as env.
The connector is **enabled when both are present**, otherwise it reports its config hint
and is skipped — never a hard failure in a multi-connector refresh.

## Collection tactics
**Org audit log**
- Window = the refresh window (default 24h). `from`/`to` are epoch milliseconds.
- Cursor-paginate via `meta.next`; cap pages per run (around ten) and widen the cadence
  rather than the cap if you hit it.
- Each event: `attributes.time`, `attributes.action`, `attributes.actor{ id, name, email }`,
  `attributes.context[]` with `containerName`/`id` for the object acted on.
- Retention on the org log is long enough that a missed day can be backfilled; keep the
  connector incremental but idempotent (normalized-row dedupe handles overlap).

**Webhooks via SIEM**
- One preset runs over both product categories. Jira and Confluence payloads have
  **different shapes**: Jira carries `webhookEvent` + `sprint`/`issue`; Confluence carries
  `eventType` + `userDisplayName` + `content{ title, spaceKey, contentType }`.
- Extract both sets with `nodrop`, then coalesce: `action = eventType ?? webhookEvent`,
  `actor = userDisplayName ?? user.displayName`, `target = content.title ?? issue.key ?? sprint.name`.
- Filter only on `action` being present. **Do not filter on actor** — sprint automation
  and system-initiated events arrive with a blank actor and an actor filter silently drops
  them (the same lesson was learned on another SaaS preset).
- Volume is low (on the order of tens to a couple hundred per week); no rollup needed.

## Normalization & joins
Normalized shape `{ source, eventTime, actor, action, target, detail }`:

| Field | Org audit log | Webhook preset |
|---|---|---|
| `source` | `atlassian` | `sumologic:atlassian` |
| `actor` | `actor.email`, else `actor.name` | display name (no email in the payload) |
| `action` | `attributes.action` (vendor verb, e.g. `user_added_to_group`, `api_token_created`) | `eventType` / `webhookEvent` |
| `target` | joined `context[].containerName` | page title / issue key / sprint name |
| `detail` | `actorId=<account id>` | `contentType · spaceKey` |

**Actor resolution** is the hard part:
- Org-log actors carry an **Atlassian account id** and usually an email; resolve the
  email through the roster ladder (explicit attribution → exact alias → local part). Keep
  the account id in `detail` so the same person is matched even after an email change.
- Webhook actors are **display names only**. Resolve by exact display-name match against
  the roster; when ambiguous, leave unmapped rather than guess. The UI should let an
  operator pin a display name → person attribution once; store it as a manual alias with
  system `atlassian` so the ladder honours it next time.
- Treat blank-actor webhook rows as `automation` (sprint rollover, scheduled jobs), not
  as unmapped humans.

Both feeds join to the same person; the person drawer shows admin actions and content
actions in one timeline.

## Signals & finding rules
| Signal | Rule | Weight |
|---|---|---|
| Material admin action | action matches `export|delete|removed|permission|api_token|token` | high — always surfaced |
| API token created | `api_token_created` (org log) | high; pair with offboarding window |
| Group/role grant to admin-grade group | `user_added_to_group` where group is an org-admin or site-admin group | high — RECERTIFY |
| Content made public / anonymous access | Confluence permission or space event granting anonymous/public | high |
| Page permission change | Confluence `eventType` with permission/restriction | medium |
| Project/space export | org-log export actions | high in offboarding scope |
| Bulk page operations | many `page_removed`/`page_updated` by one actor in a short window | medium — context for exfil scoring |
| Sprint lifecycle | sprint started/closed/deleted | low — process evidence, not security |

Offboarding scope: for a departing person's aliases, surface every material action in the
last 7 days with weight; everything else is context (capped list).

Admin oversight view: a daily "who did admin things" list from the org log, grouped by
actor with roster status — off-roster or Gone actors acting in the admin plane is a
finding on its own.

## Analyst triage & evidence
- Analyst packet per window: material actions with actor, roster status, target; admin
  grants with group names; unmapped actors list. Triage vocabulary: EXPECTED (named admin
  with a change ticket) · RECERTIFY (grant to privileged group) · INVESTIGATE (unmapped or
  off-roster actor, export, public share) · HYGIENE (stale tokens, orphan groups).
- Evidence export: the material-action list and the admin-grant list as a dataset
  snapshot. Display names and emails are kept by decision (access evidence needs them);
  account ids are not needed in exports.
- Collector health: if the webhook preset returns zero rows for a window in which sprint
  events certainly happened, the webhook or HTTP source is broken — report as BROKEN.

## Pitfalls & lessons learned
- The license tier determines what the org log contains. Verify on your tenant which
  action families actually appear before promising "user activity" coverage.
- Blank-actor rows are legitimate. An early preset with an actor filter hid every
  automation event; the fix was to filter on action only.
- Jira and Confluence webhook JSON differ enough that one extraction will not work;
  coalescing after `nodrop` extraction is the stable pattern.
- Webhook display names drift (people rename themselves). Store manual attributions by
  system so they survive.
- Org-log pagination caps can hide a busy day; monitor "pages hit cap" as a sync metric.
- Issue-tracker **content** (ticket bodies, comments) is not in either feed, by design;
  escalation and hygiene oversight on tickets uses the Jira REST API separately
  (analysis-issue-escalations).

## Do not
- Do not filter webhook events on actor presence.
- Do not treat the webhook feed as a replacement for the org audit log, or vice versa.
- Do not guess display-name → person mappings; leave unmapped and let an operator pin.
- Do not export Atlassian account ids or the org id in evidence.
- Do not use a personal API token for the org log; use an org admin API key owned by a
  role mailbox and rotate it.

## Related steering files
foundation-control-plane-architecture · monitoring-sumologic · access-atlassian ·
access-reconciliation · access-identity-lifecycle · analysis-issue-escalations ·
analysis-actor-automation-fingerprints
