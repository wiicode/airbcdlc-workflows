---
title: Issue Escalations and Intake Hygiene — ticket firehose sync, chain health, due-date board, cleanup briefs
category: analysis
system: Jira (Cloud REST + firehose export)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, monitoring-atlassian, analysis-pentest-cadence, analysis-shift-left-adoption, analysis-source-control-azure-devops]
---
# Issue Escalations and Intake Hygiene — ticket firehose sync, chain health, due-date board, cleanup briefs

## Why this matters
A security team's intake project receives everything: vulnerability reports, detections,
support asks, change requests, research questions, access requests. A subset of it is
**escalation** — a vulnerability or operational issue moved to an engineering board with
an SLA — and that subset has a process (research → target board → clone ticket → status)
whose failures are invisible in a ticket list. The rest is **hygiene**: unowned, stale or
rotting tickets that erode trust in the queue.

The control-plane mirrors the ticket firehose locally, computes chain health and queue
hygiene at read time, and exports **agent-facing briefs** that tell a human or an AI
operator exactly which field on which ticket to fix. It never writes to the ticketing
system; the operator does, and logs it.

The two universes are deliberately separate: escalations have their own table, checks and
SLA convention; the intake queue has its own table and rules. Mixing them puts noise in
the vulnerability process and vulnerability jargon in the support queue.

## Data sources & access method
| Source | Method | Use |
|---|---|---|
| Ticket firehose (a system-of-record export of the ticket project) | REST, full sweep | fast, wide snapshot: key, type, status, status group, priority, severity, disposition, escalate-to, linked issues, reporter, assignee, squad/team, labels, due date, created/updated/resolved |
| Ticketing REST `search/jql` | `project = <intake> AND statusCategory != Done`, paged 100 via `nextPageToken`; `expand=names` to find custom-field ids | the hygiene queue (open tickets only) and the escalation **truth pass** |
| Ticketing REST issue comments | per ticket, only when `updated` moved | research-done count, sign-off detection |
| Team config | `team.json` people list + automation account names + env extras | the "still ours" reporter set |
| Routing config | repo → team/owner CSV (replace the file with a fresh export) + canonical squad names with aliases, chat channel, dev manager | escalation router guardrails |

Custom field ids differ per tenant (escalate-to, disposition, severity, team). Read both
the generic and the project-specific variant and prefer whichever is set. The Team field is
an Atlassian team UUID; set it via REST with the bare UUID string.

## Collection tactics
- **Firehose first, REST for what it misses**: the export lags new tickets; for linked keys
  missing from it, fall back to REST (`expand=names` to map severity/squad).
- **Truth pass on every sync**: re-read every locally-open in-scope ticket via JQL in
  batches of 100 and refresh when the ticketing `updated` is newer. A firehose can go stale
  forever on one row (a ticket cancelled months ago still "open" locally).
- **Comment enrichment** only when `jira_updated` moved; store a trimmed comments JSON
  (author, created, 300 chars), a count, and the first sign-off hit (by, at, excerpt).
  Flatten Atlassian Document Format to text before matching.
- **Separate tables** for the intake queue (`tickets`, `sync_runs`) and escalation chains
  (`issues`); the chain table's tombstoning/enrichment loops assume the escalation
  universe.
- **Dropped sources**: cancelled intake tickets leave the picture entirely — not closed,
  not counted, not exported — even if a clone was linked before the cancel (the clone, if
  open, belongs to the squad now).
- **Read-time rules** everywhere so rules evolve without a resync; each check is a plain
  `{id, ok, note}` verdict a triage persona can later override.

## Normalization & joins
- **Chain** = intake source ticket (role `source` or `both`) → `escalate_to` target board →
  clone ticket(s) parsed from linked issues, where a destination is any linked key on a
  different board than the source. Expected clone prefixes per target (vulnerability board
  → the vulnerability board's own key prefix; incident targets → the incident boards' prefixes). Keep the map in config.
- **Closed-status taxonomy**: maintain an explicit list of statuses that end a ticket's
  life (`done, closed, completed, canceled, rejected, administrative closure, duplicate,
  false positive, informational, implemented, exception, not a coding issue, passed
  testing`…). Deliberately broader than the export's status-group formula, which lumps
  working states (REPORTED, Retest, IN TESTING) into "Closed". **Pitfall**: a status named
  like an action — `Escalated` — can itself be Done-category in the workflow, so escalated
  tickets never appear in an "open" JQL; account for it explicitly.
- **Reporter semantics**: "pending handoff" = reporter is the integration/automation
  account (plus configured extras). A security human as reporter on the vulnerability
  board is valid (the vuln owner keeps reporter by design). Match names on both the full
  name and an initial+lastname key so "A. Example" ≡ "Avery Example".
- **Sign-off** = a human all-clear in a comment: regex over `sign-off | signed off |
  all clear | clear(ed) to resolve/close | ok(ay) to close | approved to close | good to
  close | approves closure`.
- **Hygiene exclusions** at read time: `escalate_to` set, status Escalated, or key is a
  chain source; cancelled and closed statuses dropped.

## Signals & finding rules
**Escalation stage (on the source ticket)**
| Check | Rule |
|---|---|
| esc-research | ≥1 comment (null = comments never fetched) |
| esc-to | escalate-to field set |
| esc-clone | a linked ticket exists on the target board (prefix match) |
| esc-status | status actually set to Escalated |

**Progress stage (per clone; vulnerability board is strictest)**
| Check | Rule |
|---|---|
| prog-filed | linked key exists in the mirror |
| prog-reporter | reporter is not the automation account |
| prog-squad (vuln board) | team/squad set — **a teamless open clone has no owner: handoff never landed → chain red** |
| prog-due (vuln board) | due date set |
| prog-crit (vuln board) | severity set and not a placeholder (`SELECT A VALUE`) |
| prog-signoff (vuln board) | hard-fails only when resolved without a recorded all-clear; open = unknown |

**Health**: red if any escalation check fails or a teamless open vuln clone exists;
amber if any progress check fails; green otherwise. Worst first, newest inside each band;
dismissed chains sink below everything and leave the open counts (local-only dismiss with
author, reason and a clone-status snapshot; the ticketing system is untouched).

**Due-date board** over open clones: overdue · ≤7d · ≤SLA-flag days (42) · later · no due
date. Observed due-date convention by severity (Created → Due: Critical 21d / High 42d /
Medium 63d / Low 105d) is presented as a *convention to confirm*, used to suggest a due
date, never asserted as policy.

**Hygiene queue (intake project, non-escalation)** — concern order unassigned → stale →
backlog; thresholds in one place and printed in the brief:
| Disposition | Rule |
|---|---|
| ASSIGN | no assignee |
| CHASE | waiting/feedback/blocked status idle ≥ 14d |
| NUDGE | not To Do, idle ≥ 14d |
| PARK-OR-CLOSE | To Do ≥ 90d — decide, don't carry |
| GROOM | To Do ≥ 30d past intake |
| OK | moving |
Each row carries `why` grounded in numbers ("in To Do 47d past the 30d intake window").
Summaries by type and by assignee; inflow vs outflow per 30d tells you whether the problem
is growth or a stuck middle.

## Analyst triage & evidence
- **Cleanup Brief** (md/json; scope unhealthy | red | amber | all): operating rules, the
  check → fix table, conventions (legal boards, reporter set, closed/dropped statuses,
  severity scale, due-day convention, sign-off pattern), squad directory, repo ownership
  grouped by team, work queue, then per chain RESEARCH → FIX → DONE WHEN with grounded
  values (suggested due date, router suggestion, JQL fragment to check for an existing
  clone). Written **for an AI operator**, with a change-log template under each block.
- **Hygiene Brief** (scope action | unassigned | stale | backlog | all): rules encoded,
  snapshot, by type, by assignee, work queue grouped by disposition with a one-paragraph
  guide per disposition and a change-log table.
- **Escalation Router**: advisory persona suggests target board + owning squad from the
  ticket text, routing CSV and squad config; guardrails — legal boards only, squad/owner
  must exist in config; stored append-only; never writes.
- **Analyst escalation summary**: one sentence + ≤6 bullets with direction and severity;
  vocabulary FIX / RESEARCH / CHASE / DISMISS / EXPECTED.
- **Dataset**: chains with health, failing checks, destinations; headline red/amber counts,
  overdue, no-due-date, teamless clones; volatile days-to-due excluded from hashes.

## Pitfalls & lessons learned
- The firehose can go stale on a single row forever; the JQL truth pass is not optional.
- `Escalated` being Done-category means an "open" query hides the very tickets you want to
  check; query by field/status explicitly.
- A reporter rule that fails every security human will flag the whole vuln board as
  pending; fail only the automation account.
- A clone without a team is a broken handoff, not an amber detail — the rule was upgraded
  after a real miss.
- Deep-link the source key straight to the ticketing system and open the drawer on row
  click; stacking one line per clone (key → live status → progress dots) beats a joined
  cell.
- Migrations only run at DB init on a long-running server; apply new ones with the
  runner's bookkeeping or the page 500s until restart.

## Do not
- Do not write to the ticketing system from the control-plane; briefs direct, operators
  act.
- Do not mix intake hygiene rows into the escalation table or vice versa.
- Do not count cancelled sources as closed or carry them into exports.
- Do not treat the export's status group as the closed set; keep an explicit list.
- Do not assert the due-date convention as policy; present it as observed.
- Do not let the router suggest boards or squads outside the config.

## Related steering files
- monitoring-atlassian — ticketing audit/events connector
- analysis-pentest-cadence — findings that need tickets flow into the chain view
- analysis-shift-left-adoption — fix-now items and their SLA
- analysis-source-control-azure-devops — repo ownership CSV shared with routing
- foundation-ai-analyst-triage — persona and brief contract
