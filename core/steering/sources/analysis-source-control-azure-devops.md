---
title: Source Control Oversight — Azure DevOps repo↔people compliance, permissions, PATs and branch policy
category: analysis
system: Azure DevOps (Git, Graph, Entitlements, Audit, Token Administration)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, monitoring-azure-devops, monitoring-sumologic, analysis-shift-left-adoption, analysis-ai-dev-lifecycle, analysis-actor-automation-fingerprints, access-identity-lifecycle, access-reconciliation]
---
# Source Control Oversight — Azure DevOps repo↔people compliance, permissions, PATs and branch policy

## Why this matters
Compliance asks "who is working on which repositories, and should they be?" The
repository host cannot answer it because it holds three different records that are not
the same thing: a **contributor** (a git author email — free-text IDE config, often
personal), a **user** (an entitlement / sign-in identity), and a **person** (the HR
system-of-record roster entry). Add **tokens** (PATs minted by users, outliving their
seats) and **policies** (branch protections that can be weakened in one click) and you
have five surfaces that drift independently.

The control-plane syncs all five into local tables, resolves actors to roster people at
query time, and produces frozen, dated evidence: push-integrity report, permissions
review, PAT ledger, branch-policy profile per repo, spreadsheet workbook and a zipped
evidence pack with a manifest. Every number is a count over stored rows with the rule
written down; AI is used only for narrative and dispositions, never for the counts.

## Data sources & access method
| Sweep | Endpoint | Table | Scope needed |
|---|---|---|---|
| Entitlements | `vsaex …/userentitlements` | `users` | Member Entitlement Management: Read |
| Projects, repos | `_apis/projects`, `{project}/_apis/git/repositories` | `projects`, `repos` | Code: Read, Project & Team: Read |
| Access (who CAN) | Graph: project scope descriptor → project-scoped groups → `Memberships?direction=down` (transitive, memoized) → `subjectlookup` batch | `project_members` | Graph: Read, Identity: Read |
| Activity (who DID) | commits with `searchCriteria.fromDate` + `includePushData=true`; PRs per repo | `repo_activity`, `commits`, `prs` | Code: Read |
| Branch policies | `policy/configurations` per project | `policies` (+ append-only `policy_changes`) | Code: Read |
| `develop` existence | `git/refs?filter=heads/develop` per repo | `repos.develop_exists` | Code: Read |
| PAT audit feed | `auditservice …/_apis/audit/auditlog` (`Token.PatCreateEvent / PatUpdateEvent / PatRevokeEvent`) | `pats` (source `audit`) | `vso.auditlog`; **90-day retention** |
| PAT complete inventory | `vssps …/_apis/tokenadmin/personalaccesstokens/{subjectDescriptor}` | `pats` (source `tokenadmin`) | `vso.tokenadministration` **and** Project Collection Administrator |
| Audit stream in SIEM | admin/security events (policy config changes, `Git.RefUpdatePoliciesBypassed`, PAT lifecycle) | events | SIEM connector |

**Plan PAT scopes before the first sync.** The same token must carry Code (Read), Project
& Team (Read), Graph (Read), Identity (Read), Member Entitlement Management (Read),
Audit Log (Read), and — on a dedicated PCA-held token — Token Administration. A token
lacking Graph/Entitlements returns 401 on entitlements and 0 users; the access sweep then
silently degrades to direct team membership. Minting a replacement token without the
extra scopes is the most common regression. Mint a **dedicated, org-scoped** token for the
control-plane rather than reusing a developer's Git Credential Manager token; global PATs
are being deprecated.

## Collection tactics
- **Sync the roster first** in the same click, so fresh aliases resolve immediately.
- **Zero-drop guards**: 0 projects or 0 repos refuses the sweep; a per-project or per-repo
  fetch failure disables that table's tombstoning pass so a flaky run cannot mass-expire
  access or contributors. A swallowed `catch → []` on a project's repo list is a silent
  tombstone — never do it.
- **Window-scoped activity edges**: `gone_at` on an activity row means "no longer active
  in the window", not "deleted". Default window 90 days.
- **Graph access expansion**: skip `Project Valid Users` (effectively everyone); recurse
  `vssgp.` / `aadgp.` group descriptors; memoize direct-member lookups across projects
  (org squad groups nest inside many project groups); resolve every distinct subject
  descriptor **once**, org-wide, in batches; keep only human-shaped subjects
  (`principalName` containing `@`) — build-service identities are filtered. Fall back to
  team membership with a visible warning if Graph fails for every project.
- **Entitlement quirks**: some tenants answer `{items: [...], members: []}` — `items`
  carries the data; the user object has **no `id`** — `descriptor` is the key and also
  joins to `project_members.user_id`. Capture `origin` (where the account comes from).
- **Store commits** (first line, change counts, authenticated pusher) — the sync already
  paged them, storing is free, and they power the person drawer and origin verification.
- **PAT audit paging**: `batchSize=1000`, incremental from the last stored event minus one
  day of overlap, one transaction per page. The log occasionally emits an invalid JSON
  escape — tolerant parse (`\\(?![\\/"bfnrtu])` → `\\\\`) before giving up.
- **PAT tokenadmin**: try it every sync and *record the outcome* (`ok | denied | skipped |
  error`); a 401/403 becomes a coverage caveat (`audit-90d`), not a failure. ~100 ms
  between users.
- **Policy snapshot + diff**: ADO's `revision` is an edit counter; diff each sync into
  `baseline / new / modified / removed` with enabled/blocking/revision detail. Skip
  removal detection when any project's sweep failed.

## Normalization & joins
**Identity ladder** (query-time, nothing persisted pre-resolved):
1. manual attributions (`identities.system = 'azuredevops'`, created by an Assign control —
   claim a stray git email once, resolve it forever);
2. exact roster alias match (`'*'` identities written by the roster sync: formula mail,
   alternate mail, username…);
3. collision-safe local-part fallback (ambiguous local parts never match).

**Pusher truth**: the author email is claimed metadata; the **pusher** authenticated to
the host. Store distinct pusher UPNs per activity edge. An unknown author whose commits
were all pushed by resolvable employees is `foreign-authorship` (imported OSS history,
misconfigured local git), not `unmatched-contributor`; reserve the latter for unknown author
AND unknown pusher. This split collapsed a three-digit "unknowns" list to a handful.

**Identity origin**: entitlement `origin` plus UPN shape classify where an account comes
from — tenant directory (Entra), consumer account (MSA), guest (`#EXT#` UPNs), legacy or
acquired tenant domains, and `OIDCONFLICT_UpnReuse_*` artifacts (an identity re-created
after a UPN was reused). Each class is a population row and, for guest/legacy/conflict, a
finding.

**PAT holder**: the audit `TargetUser` is an internal GUID; the **actor** of a create/update
is the holder (PATs can only be minted by their owner). Tokenadmin rows carry the UPN
directly. Resolve the holder through the same ladder; join to the entitlement seat
(`display_name`, `license`, `gone_at`).

**Branch-policy profile per repo** (`develop` and the default branch): a policy applies
when enabled, same project, repo-scoped or project-wide, and the scope matches — no ref
and no matchKind = repo-wide; `DefaultBranch` only on the repo's default; `Prefix` when the
branch equals or sits under the ref; otherwise exact. Extract build validation
(definition, required, automatic, expiry), minimum reviewers (+ "reset votes on push",
creator-vote allowed, automatically-included reviewers), comment resolution, merge
strategy, work-item linking, and each **security status check** (secrets / vulnerabilities
/ SAST / IaC / licenses) as required / optional / missing.

## Signals & finding rules
| Flag / finding | Rule |
|---|---|
| `unmatched-contributor` | activity from an identifier matching nobody, pushed by nobody known |
| `foreign-authorship` | unknown author, all commits pushed by resolvable employees |
| `off-roster-access` | project member matching nobody on the roster |
| `person-gone` | resolved person with roster status Gone/Suspended/Going still holding access or committing |
| `activity-without-access` | resolved person committing without project membership (SSH-key ghosts) |
| `no-approval` PR | completed non-draft PR with zero reviewer votes ≥ "approved" |
| entitlement anomalies | entitled without IdP account · IdP-suspended but entitled · roster Gone/Going with access · dormant 90d+ (`last_accessed` null/epoch/old) |
| gate coverage | live repo whose default branch lacks an enabled **blocking** security status check |
| `NO POLICY` / `NO <scanner> GATE` / `SECRETS NOT REQUIRED` | raised only when both `develop` and the default branch lack the thing |
| `NEW — UNCONFIGURED` | `first_seen` after the module's baseline day and no policy — "config not applied to new repos" drift |
| policy bypass | SIEM `Git.RefUpdatePoliciesBypassed` count per window — who can bypass, and who did |

**PAT ledger states and flags** (flags counted on *live* tokens only, so the risk bar
equals the tiles):
| State | Rule |
|---|---|
| revoked | `revoked_at` set (audit revoke, or tokenadmin no longer lists it) |
| expired | `valid_to` ≤ now |
| expiring | `days_left` ≤ 30 |
| active | otherwise |

| Flag | Rule |
|---|---|
| `full-access` | scopes contain `app_token` (the host's "Full access") |
| `all-orgs` | `IsGlobalPat` / `isPublic = false` |
| `long-lived` | `valid_to − valid_from` > 180 days |
| `never-expires` | live and no `valid_to` |
| `holder-gone` | live, holder's roster status Gone/Suspended/Going **or** entitlement seat removed |
| `holder-unknown` | live, holder resolves to nobody |

**PAT digging tactics, in order of value**
1. Enumerate the complete inventory via tokenadmin per subject descriptor (needs PCA +
   scope). Without it, the audit feed is a **floor**: tokens minted before the retention
   window are invisible until touched.
2. Treat an `Update` or `Revoke` event for a never-seen token as proof it exists — upsert
   it with what the event carries.
3. When tokenadmin answers for a user, mark audit-only rows it does **not** list as revoked
   (admin revocation and directory disable never reach the audit feed). Mark tokenadmin
   rows not seen this run as gone.
4. Correlate `PatCreateEvent` bursts with onboarding/offboarding dates and with the SIEM
   audit stream; a full-access token created days after a departure notice is a lead.
5. Rank: full-access ∧ holder-gone > full-access ∧ long-lived > code_write/packaging held
   by an off-roster account > everything else.
6. Nothing revokes. Revocation is a two-phase human decision; expose the ledger, not a
   button.

**Non-roster contributor risk score** (deterministic, factor-based, auditor-explainable):
base 40; provenance class (tenant-only unattributed +, proven-public −); pusher
attribution (roster pushers −, none +); freemail domain +; sensitive project/repo
(security, infra, auth/pay/secret-named) +; volume; 14-day recency; service identity −.
Clamp 0–100, High ≥ 60. Nationality is never inferred; the score measures how little is
known about an identity, weighted by where it touched.

## Analyst triage & evidence
- **Origin verification**: classify unresolved author strings by domain instantly
  (host-noreply → external public, corporate typo → internal misconfig, `.local`/no-dot →
  unconfigured git, known vendors), else search the newest commit SHA against the public
  GitHub commit index: hit → imported OSS history; miss confirmed twice → tenant-only.
  Unauthenticated search returns intermittent zeros — **re-query every zero**.
- **Push Integrity Report** (compliance structure): Summary with an evidence funnel
  (records consumed → identities evaluated → findings → validated), severity-ordered
  Findings, "Reviewed & dispositioned" section (never hidden), Population tables last.
- **Dispositions** are reversible rows (type, subject, disposition
  expected/false-positive/accepted-risk, reason, author, date). An AI triage pass may
  write them under a guardrail (known types/values only; keep Suspended/Gone activity and
  recent access-lifecycle gaps OPEN) — review what it dispositioned.
- **Permissions Review**: totals, access-by-project with Gone/Going/Suspended members, an
  AI-drafted first-person assessment under the security lead's signature — label the AI
  assistance and read before release.
- **Workbook**: Projects · Permissions (project × member × sign-in × roster status ×
  granting groups) · Entitlements · Repo-People · Contributors · Pull Requests. Raw
  populations only; reports carry the judgement.
- **Evidence pack (.zip)**: reports, workbook, sanitized dataset JSON (captured as a chained
  snapshot), per-view analyst markdown, dispositions, evidence catalogue, workspace
  risks/control/GRC-links, and `MANIFEST.md` (generated-at, snapshot id + chain head, one
  line per file). Deflate via the runtime's zlib — no zip dependency.
- **Evidence catalogue**: one code-true record per artifact (what it computes, from which
  tables, audience, output, caveats, `last_generated`) shared by the UI rail, the report
  menu and the pack.
- **Analyst notes**: one model call over a compact packet → DevOps / Engineering / SecOps /
  Compliance notes, one sentence + ACT / WATCH / OK / FYI bullets, cached with model and
  date attribution.

## Pitfalls & lessons learned
- The audit log holds **admin/security events only**; commits and PRs are *not* in it —
  the REST sync is the sole source. `Git.RefUpdatePoliciesBypassed` is, however, excellent
  detection material.
- "Active PAT" counts without tokenadmin **overstate**; a suspended external shown with two
  live tokens had none. Say "audit-90d coverage, a floor" wherever the number appears.
- PDF via headless browser may be blocked by endpoint policy on the operator's machine;
  ship HTML and let the browser print.
- Imported open-source history pollutes both the contributor list and the CNAPP posture
  score (the scanner treats every repo as a workload). Map repo → upstream public project
  as a vendored-code inventory.
- The gate-coverage rule on the Policies view and the per-repo profile rule intentionally
  differ; changing the older one shifts a trend line — version the rule, don't silently
  edit it.
- Name token facts `pats_*` / `holder_status` / `scope_summary` in datasets; a `tokens_*`
  key is dropped by the secrets sanitizer.

## Do not
- Do not persist resolved identities; resolve at query time through the ladder.
- Do not mint the control-plane's token from a developer's credential manager; use a
  dedicated org-scoped PAT with the full read-scope set and a separate PCA token for token
  administration.
- Do not hide dispositioned findings; move them to a reviewed section with reason/author.
- Do not expose or export PAT `raw`, scopes beyond a summary, or any token material.
- Do not let an AI write Jira, revoke tokens or change permissions from this module.
- Do not infer nationality or intent from author strings or domains.
- Do not tombstone any table from a run with partial fetch failures.

## Related steering files
- monitoring-azure-devops — the SIEM audit stream (policy changes, bypasses, PAT events)
- analysis-shift-left-adoption — scanner adoption per repo joins to `repos` here
- analysis-ai-dev-lifecycle — harness files are read with the same token
- analysis-actor-automation-fingerprints — build-service GUID pushers
- access-identity-lifecycle, access-reconciliation — roster status and IdP joins
- foundation-evidence-datasets-snapshots — pack manifest and snapshot chain
