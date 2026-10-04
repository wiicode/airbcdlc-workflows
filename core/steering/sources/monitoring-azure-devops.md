---
title: Azure DevOps — org audit via SIEM with PATs as a first-class signal
category: monitoring
system: Azure DevOps (Services)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, monitoring-sumologic, analysis-source-control-azure-devops, analysis-shift-left-adoption, analysis-actor-automation-fingerprints, access-identity-lifecycle, access-reconciliation]
---
# Azure DevOps — org audit via SIEM with PATs as a first-class signal

## Why this matters
Source control is where intellectual property lives and where a compromised or departing
identity does the most quiet damage: mint a token, clone everything, bypass a branch
policy, delete a repo. The Azure DevOps org audit log records the admin and security
plane in detail, but the raw stream mixes humans, pipeline identities and the platform
itself, and the default view hides exactly the automation layer where out-of-band tooling
appears. The control-plane splits one stream into three presets with different purposes,
and treats **Personal Access Token creation** as a signal in its own right rather than
background noise.

Two facts shape everything here:
- Commits and pull requests are **not** in the audit log by design. Activity ("who DID")
  comes from the REST API (analysis-source-control-azure-devops); the audit log is the
  admin/security plane ("who changed the rules, who minted credentials").
- The audit log **retains 90 days**. A token minted earlier is invisible until touched.

## Data sources & access method
| Source | Access | Covers |
|---|---|---|
| Org audit log → SIEM | Audit streaming to the SIEM's HTTP source; queried with Search Job presets | Admin/security events: pipelines, policy config, permissions, PAT lifecycle, repo create/delete, policy bypass, service-connection use |
| Org audit log → direct | `GET https://auditservice.dev.azure.com/{org}/_apis/audit/auditlog?api-version=7.1-preview.1&batchSize=1000&startTime=&continuationToken=` with PAT scope `vso.auditlog` | Same events, used for the PAT ledger (incremental, idempotent) |
| Token Administration API | `personalaccesstokens` per subject descriptor; needs Project Collection Administrator **and** PAT scope `vso.tokenadministration` | The complete live PAT inventory incl. expiry — the only truthful "active token" source |
| Commits / PRs / repos | Git REST API (`searchCriteria.fromDate`) | Activity plane (separate steering file) |

Audit fields of interest: `ActorUPN`, `ActorDisplayName`, `OperationName` (`ActionId`),
`ProjectName`, `IpAddress`, `Details`, `Data{ ... }`, `Timestamp`.

## Collection tactics
Three SIEM presets over the same source, each with a distinct job:

| Preset | Filter | Enabled by default | Purpose |
|---|---|---|---|
| **Human audit** | `ActorUPN matches "*@*"` | yes | Human admin/security actions only; the daily oversight view |
| **Automation & security-sensitive ops** | `OperationName matches "Pipelines.*"` OR `= Token.PatCreateEvent` OR `= Git.RefUpdatePoliciesBypassed` OR `= Git.RepositoryDestroyed` OR `= Security.RemoveAccessControlLists` — **no actor filter** | yes | The layer the human preset drops: pipeline runs, service/pipeline identities, token minting, policy bypass, destructive ops |
| **Service-connection executions** | `Library.ServiceConnectionExecuted` | **no** | Fires on every pipeline step that uses a service connection (cloud accounts, registries, scanners). High volume; enable only when hunting what automation reaches external services |

Why the split: the first preset existed alone and a security review performed entirely
through pipelines, scripts with PATs, and service connections was **invisible** to the
control-plane. The automation preset was added after that gap; the actor shows as the
platform service for pipeline runs and that is intended.

Direct audit pull for the PAT ledger:
- Incremental from the newest stored event minus one day of overlap; continuation-token
  paging; `batchSize` 1000.
- The API occasionally emits an **invalid JSON escape**; parse tolerantly (retry the parse
  after escaping stray backslashes) rather than failing the sync.
- Try the Token Administration API every sync and **record whether it worked**
  (`ok / denied / skipped / error`). Coverage caveat travels with the data: without it,
  "active PAT" is inferred from a 90-day audit window and overstates for anyone whose
  tokens were revoked outside the feed.
- A dedicated PAT carrying `vso.tokenadministration` may be configured for the admin
  call, falling back to the main PAT.

## Normalization & joins
Normalized row: `actor = ActorUPN`, `action = OperationName`, `target = ProjectName`,
`detail = Details` (+ `IpAddress` for the automation preset). Source `sumologic:azuredevops`.

**PAT ledger** (`authorization_id` as key): `target_upn` (holder), `actor_upn` (who
minted/updated), `display_name`, `scopes`, `is_global` (all orgs), `valid_from`,
`valid_to`, `created_at`, `revoked_at`, `last_event_at`, `source` (`audit` | `tokenadmin`),
`seen_live_at`. Audit events `Token.PatCreateEvent` / `PatUpdateEvent` / `PatRevokeEvent`
upsert with `COALESCE` so a later event never blanks a field an earlier one filled.

Joins: holder UPN → ADO entitlement (license, `gone_at`) → roster person + status via the
identity ladder (manual attribution → exact alias → local part). Build-service GUIDs and
pipeline identities are set aside, not matched.

Derived per token: `state` (active / expiring ≤30d / expired / revoked), `lifetime_days`,
`days_left`, and flags.

## Signals & finding rules
| Flag / signal | Rule |
|---|---|
| `full-access` | scopes contain the full-access token scope |
| `all-orgs` | `is_global` — token valid across every organization the holder can reach |
| `long-lived` | lifetime > ~180 days |
| `never-expires` | live token with no `valid_to` |
| `expiring` | live, ≤30 days left (rotation hygiene, not risk) |
| `holder-gone` | live token whose holder is Gone/Suspended on the roster or whose entitlement is gone |
| `holder-unknown` | live token whose holder resolves to nobody |
| Policy bypass | `Git.RefUpdatePoliciesBypassed` — count per actor per window; this is good detection material |
| Destructive op | `Git.RepositoryDestroyed`, `Security.RemoveAccessControlLists` |
| PAT creation | `Token.PatCreateEvent` / `Token.SshCreateEvent` — always surfaced, weighted |

Risk chips count **live** tokens only so they match the headline tiles; a state chip adds
the expired/revoked history.

**Offboarding exfil signals** (7-day window around the departure): commits (context),
PRs, `pat-created` (high weight), `pat-active` with full access (high), policy bypasses,
token-create audit events. A PAT minted in the last week by someone being offboarded,
with full access and a far expiry, is the single strongest pre-departure signal this
system produces. Show "not observable: clone/pull" in the UI — Git fetches are not
audited.

## Analyst triage & evidence
- Tokens view: every token joined to seat + roster; sort expiring → active → expired →
  revoked, then by flag count. Nothing on the page revokes; revocation is a deliberate
  two-phase action, not a sync side effect.
- Triage vocabulary: REVOKE (holder-gone, holder-unknown) · RECERTIFY (full-access,
  all-orgs, never-expires held by active staff) · HYGIENE (long-lived, expiring) ·
  INVESTIGATE (policy bypass clusters, destructive ops without a change record).
- Evidence dataset collections: `pats` (holder, holder_status, state, scope_summary,
  flags), findings; headline metrics `pats_holder_gone`, `pats_full_access`,
  `no_approval_merges`. Name token facts `pats_*` so a generic secret-sanitizer that drops
  `token*` keys keeps them.
- Record the tokenadmin status in every evidence export; auditors must know whether the
  inventory is complete or audit-inferred.

## Pitfalls & lessons learned
- Filtering to `*@*` actors is right for the human view and wrong as the only view; keep
  the automation preset enabled.
- Service-connection events will dominate volume if left on; use them surgically.
- The audit log's 90-day retention makes "active token" counts inferred. One verified
  case: a suspended external contractor showed two "active" tokens that the admin API
  proved were gone. Ship the tokenadmin path even if it is denied today, and surface the
  denial.
- Policy-bypass counts in the audit log are a reliable, cheap detection; branch-policy
  config changes also attribute actors via `Policy.PolicyConfig*` events.
- The connector PAT itself is a privileged credential: scope it minimally
  (`vso.auditlog`, Graph read, entitlements read), own it by a role, and plan for the
  platform's deprecation of global PATs.
- Audit JSON can be malformed; a tolerant parser prevented repeated sync failures.

## Do not
- Do not count commits/PRs from the audit log; they are not there.
- Do not revoke tokens from a sync routine.
- Do not treat audit-derived "active" as proven while tokenadmin is denied.
- Do not store the token value or `raw` audit payload in exports.
- Do not drop blank-actor or service-actor rows in the automation preset.

## Related steering files
foundation-control-plane-architecture · monitoring-sumologic ·
analysis-source-control-azure-devops · analysis-shift-left-adoption ·
analysis-actor-automation-fingerprints · access-identity-lifecycle · access-reconciliation
