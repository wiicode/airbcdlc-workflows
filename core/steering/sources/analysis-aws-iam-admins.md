---
title: AWS Administrators, Roles, Secrets and Trusted Advisor Overlap
category: analysis
system: AWS IAM, IAM Identity Center, AWS Organizations, Secrets Manager, Trusted Advisor, CloudTrail
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-privacy-safety-secrets, analysis-aws-identity-reconciliation, analysis-aws-waf-edge, monitoring-aws-cloudtrail, monitoring-orca, monitoring-jumpcloud]
---
# AWS Administrators, Roles, Secrets and Trusted Advisor Overlap

## Why this matters
"Who is an AWS admin?" has no single answer in an estate that grew before and after AWS Control Tower. Administrator access lives in several places at once: Identity Center permission sets assigned to groups and directly to users, legacy IAM users and groups with `AdministratorAccess` attached, and automation roles that carry it for pipelines. An access review that enumerates one layer and calls it done misses the others. The same is true of secrets (who reads them, how fat they are, whether they rotate) and of the "is anything using this role" question. This file covers four read models built on one credential discipline: admins, roles, secrets, and Trusted Advisor as a surgical cross-check on the CSPM.

## Data sources & access method
| Layer | APIs (read-only) | Served by |
|---|---|---|
| Identity Center | sso-admin: ListInstances, ListPermissionSets, DescribePermissionSet, ListManagedPolicies / CustomerManagedPolicyReferences / GetInlinePolicy for the permission set, ListAccountsForProvisionedPermissionSet, ListAccountAssignments | SecurityAudit in the **management account** |
| Identity store | identitystore: ListGroups, ListGroupMemberships, ListUsers / Describe* | **Denied** to SecurityAudit in the management account; falls back per call to an audit-account admin profile |
| Organizations | ListAccounts, DescribeOrganization | management account (install the SDK client — it is not a transitive dependency) |
| Legacy IAM (every covered account) | ListEntitiesForPolicy on `AdministratorAccess`, GetGroup, GetUser, GetRole, ListAttached*Policies, GetPolicy / GetPolicyVersion | SecurityAudit per account |
| Roles | ListRoles + one GetRole per role (ListRoles omits RoleLastUsed) | SecurityAudit |
| Secrets Manager | ListSecrets (metadata only), GetSecretValue **transiently for key-shape only** | SecurityAudit; `ListSecrets` is denied under ReadOnly |
| CloudTrail | LookupEvents filtered to `secretsmanager.amazonaws.com`; local events table for AssumeRole and GetSecretValue | SecurityAudit |
| Trusted Advisor | Support API: DescribeTrustedAdvisorChecks → CheckSummaries → CheckResult (flagged only), us-east-1 | SecurityAudit; never `RefreshTrustedAdvisorCheck` (a mutation) |

**Per-API-family credential fallback.** Try the management-account entry first, then the audit entry; the first non-denied profile stays sticky for that family; record which profile served each family in the run's coverage JSON. Resolve each entry's account id with `sts:GetCallerIdentity` and skip entries that resolve to an account already covered (a narrow-role entry into the production account is a duplicate, not a second account). Entries whose profile does not exist are recorded as *not covered* — a coverage gap is a finding, not an error to swallow.

## Collection tactics
- **All network first, one DB transaction after**, with no network awaits inside the transaction (it holds a pooled connection).
- Swept tables carry `first_seen / last_seen / gone_at`. A layer that failed **never gone-marks its rows**; otherwise a denied call reads as "all admins removed".
- Bounded concurrency (4–6) on per-entity fan-out (GetRole, GetUser, ListMFADevices…).
- Rate-limited APIs (Support) are swept one account at a time with a small delay between result calls.
- Trusted Advisor is one snapshot per AWS account id; checks and flagged resources are lifecycle tables; a changes ledger records NEW / CHANGED / GONE against the prior snapshot like every other sync.
- **Secrets hard guardrail**: values are never stored, logged or returned. A value is read transiently only to count and name its top-level JSON keys, then discarded. Only key count, key names, metadata and access events persist. There must be no code path that writes a value anywhere.

## Normalization & joins
**Permission-set grading** (pure function, fixture-tested):
- `admin` — AWS-managed `AdministratorAccess`, or an inline / readable customer-managed policy with `Action "*"` (or `"*:*"`) on `Resource "*"` with Effect Allow. Parse JSON properly: Action/Resource may be string or array; IAM returns documents URL-encoded. `NotAction` statements are not graded — say so.
- `privileged` — PowerUserAccess, IAMFullAccess, OrganizationsFullAccess, SSO administrator policies, or any `…FullAccess` on the identity planes (IAM / Organizations / SSO / Identity Store).
- `other` — everything else. Inline or customer-managed policies that are not `*:*` are listed as "not graded".

**Role classification**: `sso` (`AWSReservedSSO_*`), `control-tower` (the Control Tower / StackSet / AFT execution roles), `automation` (name matches terraform / cdk / pipeline / deploy / CI patterns, or trust principal is CloudFormation / CodeBuild / CodePipeline / GitHub OIDC / GitLab), `other`. Service-linked and SSO roles are exempt from unused flags; they exist because a service needs them to.

**Trust policy → principals**: parse `AssumeRolePolicyDocument` (URL-decoded), collect Service / AWS / Federated principals from Allow statements; any AWS account id outside the organization's account list is `external-trust`. Build that list from Organizations `ListAccounts`, not a hardcoded array — a hardcoded list produced false positives the day a new member account appeared.

**People join**: Identity Center email → system-of-record roster (status label), EDR people type, directory state; legacy IAM user → person via the manual ARN attribution first, then the IAM sweep's person, then email / local-part. Last AWS login = newest directory SSO event whose app is the AWS account application (directory retention is typically ~90 days — only raise "unused" when that evidence exists).

**Secrets access classification**: actor type from CloudTrail `userIdentity` (IAMUser, AssumedRole, AWSService, Root, federated). An assumed role is *service* when the role name looks like a task / exec / CI / deploy role; SSO and human role names are human even though assumed. User-agents matching aws-cli / boto / curl / Postman / HTTPie mark an interactive endpoint read (human exfiltration surface) as opposed to an in-app SDK runtime. Monitoring reads (the control-plane's own role plus an in-app SDK UA) are tagged and excluded from counts.

**Pseudo-SQL for the joins that decide the flags**

```sql
-- dual-path: a person with an Identity Center admin route AND a legacy IAM admin entity
SELECT p.person_key
  FROM idc_admin_routes p
  JOIN iam_admin_entities i ON i.person_key = p.person_key
 WHERE p.tier = 'admin' AND i.policy = 'AdministratorAccess';

-- last AWS SSO login per person from the directory SSO feed (window-limited evidence)
SELECT lower(email) AS email, MAX(ts) AS last_aws_login
  FROM sso_events
 WHERE app_type = 'aws-sso' OR app_label LIKE 'AWS Account%'
 GROUP BY lower(email);

-- empty admin groups
SELECT g.id FROM idc_groups g
  LEFT JOIN idc_group_members m ON m.group_id = g.id
 WHERE g.is_admin_route = 1 GROUP BY g.id HAVING COUNT(m.user_id) = 0;
```

**Build order when adding this to a control-plane**: (1) accounts config + probe script; (2) Identity Center layer with per-family fallback and coverage JSON; (3) legacy IAM layer via `ListEntitiesForPolicy`; (4) people join reusing the identity-reconciliation attribution; (5) pure model (grading, flags, matrix, CSV/MD) with fixtures; (6) report + dataset; (7) roles, secrets and Trusted Advisor as sibling services on the same ledger.

## Signals & finding rules
**Admins — person-level flags with verbs**

| Flag | Verb | Rule |
|---|---|---|
| dangling-principal | REMOVE | assignment to an id the identity store cannot resolve (suppresses every other flag) |
| person-gone / jc-suspended | REMOVE | roster Gone / Suspended / Going, or directory suspended |
| dual-path | REMOVE | admin via Identity Center AND legacy IAM — remove the IAM path |
| legacy-iam-admin | REMOVE (or justify) | IAM user with AdministratorAccess |
| off-roster | RECERTIFY | shared mailbox / role account — needs a named owner |
| direct-assignment | MOVE-TO-GROUP | permission set assigned to the user, not a governed group |
| mgmt-account-admin | RECERTIFY | admin in the management account (highest blast radius) |
| unused-90d | RECERTIFY | no AWS SSO login in 90 days (only when directory evidence exists) |
| non-jc-group | INVESTIGATE | admin via an Identity Center group with no same-named directory group and no SCIM external id (typically Control Tower-created) |
| empty-admin-group | REMOVE | admin group with no members |
| automation-admin-role | EXPECTED / INVESTIGATE | non-SSO, non-Control-Tower role with AdministratorAccess — INVESTIGATE when it trusts a foreign account, is unexplained, or is idle > 1 year / never used |

**Roles**: `external-trust` (red, review queue first) · `never-used` (no RoleLastUsed, no observed AssumeRole, older than 180 d) · `unused-1y` · `unused-180d`. Three usage layers, labelled by strength: trust policy (structural, always available) → IAM RoleLastUsed (authoritative, ~400 d tracking) → observed AssumeRole callers from the local CloudTrail rail (evidence, window-limited, never presented as complete). Trust-policy fields are TRACKED so a trust edit lands in the drift feed.

**Secrets**

| Flag | Rule | Risk points |
|---|---|---|
| fat-secret | ≥15 top-level keys (blast radius) | 4; 6 when ≥30 |
| human-cli-read | a human actor read it from an interactive UA | 5 |
| human-only-reads | reads in window but none from a service actor (baked-in-deploy or manual handling) | 3 |
| no-rotation | rotation disabled | 2 |
| stale-unrotated | no rotation and last changed > 180 d | 2 |

Also: consumers inferred from Lambda environment variables whose value equals the secret name or ARN; `unused` when last-accessed > 90 d. Sort by risk, then access volume. Cadence label per secret: none / human-only / service / mixed.

**Trusted Advisor overlap** — a hand-maintained, code-reviewed mapping, treated like a policy file: `cspm-covers` (the CSPM evaluates the same condition; Security Hub FSBP controls surfaced in TA map to the CSPM's FSBP framework by default, with an exceptions table), `ta-only` (AWS-internal signals: leaked-key scanning, Access Analyzer, origin-certificate probes, lifecycle notices), `unmapped`. The TA panel shows only `ta-only` and `unmapped` checks by default — "use Trusted Advisor surgically".

## Analyst triage & evidence
- **Report** (print layout): headline → roster of admins → person × account matrix → by account → findings grouped by flag with verb → automation roles → privileged (non-admin) sets → **method & coverage** (which profile served which API family, which accounts were not covered, what is not graded).
- **Not graded, stated explicitly**: customer-managed / inline policies on IAM principals (only the AWS-managed AdministratorAccess attachment is enumerated), resource-based policies, root users (covered by the identities report), SCP and permission-boundary reductions.
- Exports: CSV = one row per person × account × route (via group / direct / legacy-iam), Markdown, JSON; dataset collections `people`, `by_account`, `automation` for snapshot and delta.
- Drift view: NEW / GONE assignments and IAM admin entities in the last 30 days.
- Secrets evidence: per secret, the last 20 access events (time, actor, type, IP, UA) — never a value.

## Pitfalls & lessons learned
- Management-account SecurityAudit reads sso-admin but **not identitystore**; resolve users and groups from a second profile and record the fallback. Without it, every assignment looks dangling.
- `ListRoles` omits RoleLastUsed; budget one GetRole per role.
- `AWSReadOnlyAccess` denied Secrets Manager listing silently for months — the sync "succeeded" with zero rows. Treat a zero-row sweep on a layer that previously had rows as suspicious.
- A hardcoded org-account list for external-trust detection goes stale. Derive from Organizations.
- Flag order matters for readability: a dangling principal carries only that flag.
- Permission-set grading on `NotAction` is unsafe to automate; list it, do not grade it.

## Do not
- Do not store, log, print or return a secret value, even truncated, even in an error message.
- Do not call Trusted Advisor refresh or any other mutating API from a read model.
- Do not gone-mark rows from a layer whose sweep failed or was denied.
- Do not raise `unused-90d` without directory login evidence covering the window.
- Do not grade a permission set admin on name alone; parse the policy.
- Do not present observed AssumeRole callers as complete usage; the window is the CloudTrail rail's, not AWS's.

## Related steering files
- analysis-aws-identity-reconciliation — the IAM-user ↔ roster join these flags build on
- analysis-aws-waf-edge — same credential model and probe discipline
- foundation-privacy-safety-secrets — the secrets guardrail in general form
- monitoring-aws-cloudtrail — the events rail for AssumeRole and GetSecretValue
- monitoring-orca — the CSPM the Trusted Advisor overlap is judged against
- monitoring-jumpcloud — directory state and SSO login evidence
