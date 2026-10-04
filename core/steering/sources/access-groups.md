---
title: IdP Group Inventory, Hygiene, and Guarded Bulk Operations
category: access
system: JumpCloud user groups (IdP)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [access-identity-lifecycle, access-reconciliation, monitoring-jumpcloud, analysis-sso-adoption-metrics, foundation-control-plane-architecture, foundation-privacy-safety-secrets]
---
# IdP Group Inventory, Hygiene, and Guarded Bulk Operations

## Why this matters

In an IdP, groups *are* the entitlements: application bindings, device policies, and directory sync all hang off group membership. Suspending a leaver stops sign-in but leaves every group edge in place, so the moment anyone reactivates the account — or a dynamic rule re-evaluates — the full footprint returns. Groups also rot quietly: empty groups, groups bound to nothing, and privileged groups still holding people the roster says are gone. The method here inventories every group and edge, grades them against the roster, and offers a bulk clean-up gated by dry-run, typed count approval, and live re-validation — because a bulk write against the IdP is the most dangerous thing a control-plane can do.

## Data sources & access method

| Call | Purpose | Note |
|---|---|---|
| `GET /api/v2/usergroups` (paged) | Group list: id, name, description | The **list response does not carry `membershipMethod`** |
| `GET /api/v2/usergroups/{id}` | Detail: `membershipMethod` (STATIC vs DYNAMIC_*), `memberQuery` | One call per group; best effort — a failure leaves the column null |
| `GET /api/v2/usergroups/{id}/members` (paged) | Member edges `{to:{id,type}}` | Keep `type == user` only |
| `GET /api/v2/users/{id}/memberof` (paged) | Per-user reverse lookup | Used at plan time and for the per-user count button |
| `GET /api/systemusers/{id}` | Live user state (`suspended`) | Re-verification before any write |
| `POST /api/v2/usergroups/{gid}/members {op:"remove", type:"user", id}` | Remove one edge | The only write |
| Group-expanded app bindings | Which applications a group grants | From the IdP SSO application inventory sync (see analysis-sso-adoption-metrics) |

Auth is a single API key in the `x-api-key` header via one shared fetch helper with 429 retry; the key is never logged. Console deep links are generated from the 24-hex id (`console.jumpcloud.com/#/users/{id}`, `/#/groups/user/{id}`) and are null for anything that does not match the id shape.

## Collection tactics

- **Three sweeps per sync**: list → per-group detail → per-group members, with a small worker pool (concurrency ~5). A per-group members sweep costs one call per group (dozens); a per-user `memberof` sweep costs one per user (hundreds). Prefer the former for inventory.
- **Zero-drop guards.** A 0-group pull refuses the sweep outright. A 0-edge parse while the previous sync had edges skips the members sweep with a warning instead of tombstoning every edge. Both mirror the pattern used by every other IdP sync in the control-plane.
- **Shared table discipline.** The groups table is also written by the SSO inventory sync. Both full-sweep it; each only updates the columns it owns and leaves the other's untouched.
- **Per-user `group_count`** is filled only when the pass succeeds (null = never counted). It drives a traffic-light button on the identity row: green > 3, amber 1–3, red 0, unstyled when null.
- **Roster status by email** is resolved from the roster sync (a `roster:<Status>`-style label on the identity) at read time, so a roster change shows on the next refresh without a group sync.
- **Console link generation** is a pure helper shared by server reports and client pages: validate the 24-hex id shape, build the user or group URL, return null otherwise. Links carry a fixed title ("open the IdP record — devices, groups, lock/wipe live there") so operators know what they will find before clicking.

## Normalization & joins

```
jc_user_groups(id PK, name, description, membership_method, member_count, raw_json, first_seen, last_seen, gone_at)
jc_group_members(group_id, user_id PK, first_seen, last_seen, gone_at)
jc_group_sync_runs(started_at, finished_at, status, groups_count, members_count, error)
```

- Join `jc_group_members.user_id` → `jc_users.id` for state and email; email → roster for status.
- **Going/Gone** on this page is deliberately narrower than the access-review definition (no Suspended): the page is about *offboarding drift*, not entitlement review.
- **Inconsistent group** = any group with ≥ 1 Going/Gone member. Static inconsistent groups are the actionable set; dynamic membership is rule-driven and a manual removal may be re-added by the member query — the drawer warns.
- Group-expanded app bindings join `group_id` → application binding rows, giving "this group grants these apps". A leaver in a group bound to a production app is worse than one in a social group.

Pseudo-SQL for the inconsistent-group report (one payload drives the table and the report card):

```sql
SELECT g.id, g.name, g.membership_method,
       COUNT(*) FILTER (WHERE i.roster_status IN ('Going','Gone')) AS going_gone,
       ARRAY_AGG(json_build_object('user_id', u.id, 'email', u.email,
                 'roster_status', i.roster_status, 'jc_state', u.state,
                 'jc_suspended', u.suspended))
         FILTER (WHERE i.roster_status IN ('Going','Gone')) AS people
FROM jc_user_groups g
JOIN jc_group_members m ON m.group_id = g.id AND m.gone_at IS NULL
JOIN jc_users u         ON u.id = m.user_id AND u.gone_at IS NULL
LEFT JOIN identities i  ON lower(i.email) = lower(u.email)
WHERE g.gone_at IS NULL
GROUP BY g.id ORDER BY going_gone DESC, g.name;
```

## Signals & finding rules

| Finding | Rule | Severity | Action |
|---|---|---|---|
| Leaver in group | member whose roster status is Going/Gone | high if the group binds an app or policy, else medium | remove the edge (static) / fix the member query (dynamic) |
| Privileged group with leavers | leaver in a group whose name or bindings mark it admin/sudo/production | high | remove now; review group ownership |
| Suspended user still in groups | `jc_users.suspended = 1` and `group_count > 0` | medium | bulk remove (see gate below) |
| Empty group | `member_count == 0` | low | delete or document purpose |
| Group with no bindings | no application, policy, or directory binding | low | delete or document purpose |
| Dynamic group silently dropping | detail call fails repeatedly | info | investigate API or shape drift |
| Catch-all dynamic group holds suspended users | an "all users" dynamic group counts suspended members | info | adjust the member query to exclude suspended |

Summary counters: total, static, dynamic, inconsistent, static-inconsistent, member edges, distinct Going/Gone people, `roster_loaded` (false → banner: checks are blind).

## Analyst triage & evidence

**Single removal** (review drawer): the drawer listing *is* the review step; one click = one removal; the local edge is tombstoned and both the group's `member_count` and the user's `group_count` are recomputed so the groups and identities pages agree without a full sync.

**Bulk remove groups from suspended users — the gate.** Pure core (no DB/network; every IdP call injected) so the whole gate is unit-tested with mocks; DB and live wiring are a thin layer around it.

1. **Dry run → plan.** Take every mirrored user with `suspended = 1 AND gone_at IS NULL`; re-verify each **live** (`suspended === true`; 404 = not found live); fetch live memberships. Exclusions are applied **and listed**, never silent: `zero-groups`, `retain-flag` (any person on an open offboarding cohort with a retain / "don't disable" marker), `operator-user`, `operator-group`, `all-groups-excluded`, `lookup-error`. Users suspended in the mirror but not live are a separate list. Excluded memberships are stored as `skipped` items. Persist the plan with a TTL (30 min) and a `plan_hash` = sha256 of the sorted `user:group` pairs. A new dry run supersedes any open plan, so only one is approvable at a time.
2. **Review.** Counts (users · memberships · groups), per-group table with DYNAMIC badges, per-user expandable table, exclusions, plan id and hash, expiry countdown. Exclude checkboxes stage exclusions and re-run the dry run. **Download plan CSV** is the approval record (formula-injection guarded cells).
3. **Count-validated approval.** The red button stays disabled until the operator types *both* numbers (users, memberships) and the literal phrase exactly. Server rejects: unknown plan → 404; expired; wrong status; count or phrase mismatch (plan stays approvable, retype). Then claim the plan atomically (`planned → approved`) so a double-click or second tab cannot run it twice.
4. **Re-validation before any write.** Stored pending items must still hash to `plan_hash` and match the approved counts; every planned user is re-verified suspended live and memberships re-fetched; current ∩ planned must equal the planned count. Any drift → 409 with a diff (planned, still present, missing, no-longer-suspended, lookup errors, added-since-plan), plan → `aborted`, **no writes**.
5. **Execute** exactly the planned pairs (concurrency ~3), persisting per-item status as it goes: `removed` / `already-absent` (re-checked after a failed call) / `failed` + error. Plan `executing → done`; refresh `group_count`; the UI polls for a live counter, then shows results (failures first), a results CSV, and **Retry failed** (a new plan restricted to the failed pairs — same gate).

**Never touched:** users not suspended live at plan *and* execute time; retain-flagged people; operator exclusions; memberships added after the dry run; anything other than user-group edges.

**Audit trail:** the plan tables are the record (every pair, status, error, time; plan approved/started/finished, counts, abort diff) plus one action-log row per executed or aborted plan carrying the plan hash. Analyst reports cite the plan id and hash.

## Pitfalls & lessons learned

- **`membershipMethod` is detail-only.** The first inventory showed every group as static until the detail call was added.
- **Dynamic groups re-add.** A manual removal from a dynamic group was undone on the next rule evaluation; badge dynamic groups and point to the member query instead.
- **Catch-all groups are noise.** Every suspended user was still in the tenant's "all users" dynamic group; this is expected and should be excluded or fixed at the query, not removed one by one.
- **Mirror vs live.** The mirror said suspended; live said active for a handful after reactivations. Re-verify live at plan and at execute.
- **Server death mid-execute** leaves a plan `executing` with `pending` items; "Retry failed" only picks up `failed`. Start a new dry run instead — document this edge.
- **Approval by typing counts** caught a real drift once: the operator noticed the membership count had changed between dry run and approval and re-ran.
- **Roster not loaded = blind.** Without the roster label the inconsistent-group check silently passes everything; show a banner.

## Do not

- Do not write to the IdP from a plan older than its TTL or whose hash no longer matches.
- Do not execute without re-verifying every user's suspended state live.
- Do not remove edges from users with an offboarding retain flag, even if suspended.
- Do not touch dynamic groups from the bulk path; fix the member query.
- Do not hide exclusions — list every one with its reason and membership count.
- Do not let two plans be approvable at once; a new dry run supersedes.
- Do not infer group privilege from the name alone when bindings are available.
- Do not log or echo the IdP API key; it travels only as a header through one helper.

## Related steering files

- access-identity-lifecycle — the suspend action that precedes bulk group removal
- access-reconciliation — the shared action log and roster status source
- monitoring-jumpcloud — Directory Insights events for admin-actor detection
- analysis-sso-adoption-metrics — application bindings used to weight group risk
- foundation-control-plane-architecture — shared fetch helper, zero-drop sweep pattern
- foundation-privacy-safety-secrets — key handling and CSV injection guards
