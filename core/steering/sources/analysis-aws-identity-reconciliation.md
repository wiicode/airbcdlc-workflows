---
title: AWS Identity Reconciliation Against the People System-of-Record
category: analysis
system: AWS IAM, IAM Identity Center, people system-of-record, JumpCloud (SCIM source)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, analysis-aws-iam-admins, access-reconciliation, access-identity-lifecycle, analysis-access-revocations, monitoring-jumpcloud]
---
# AWS Identity Reconciliation Against the People System-of-Record

## Why this matters
The governance question "who actually has access to our AWS, and does it match HR?" had no single source of truth. Identity Center users are SCIM-provisioned from the directory and mostly line up with the roster; legacy IAM users in the pre-Control-Tower production account do not — they are humans carrying long-lived passwords and access keys under usernames like `flast` or a bare first name. The "not yet on Control Tower" migration backlog *is* the legacy IAM human population, and nobody could list it. The first reconciliation found a root account without MFA, console users matching nobody on the roster, a suspended person with a recent console login, and access keys older than six years. The point of this file is to make that answer repeatable: one sweep, one join, a fixed flag vocabulary, and drift tracked forward.

## Data sources & access method
| Source | What | Access |
|---|---|---|
| IAM (per account) | ListUsers, ListMFADevices, ListAccessKeys, GetAccessKeyLastUsed, GetLoginProfile, ListGroupsForUser, GetAccountSummary (root MFA) | SecurityAudit via SSO profile |
| Identity Center | ListInstances (auto-discover the instance from the first account that can read it), identitystore ListUsers | audit-account profile; the management account's read role may deny identitystore |
| People system-of-record | roster table: name, email variants, usernames, Status (Active / Gone / Suspended / Going / Coming / Service Account / Preserve / Missing / Ignore), plus a manual **AWS ARN attribution** field | REST API, throttled roster sync (~6 h), forced on demand |
| Directory | user state (activated / suspended) for corroboration | JumpCloud API snapshot |

**Read profiles must be SecurityAudit, not AWSReadOnlyAccess.** ReadOnly denies `iam:GetAccessKeyLastUsed` and credential reports, so key *usage* is unknowable and only key *age* is visible — an access limitation that is itself a finding. ReadOnly also denies Secrets Manager listing and WAF `GetWebACL`. SecurityAudit covers IAM credential inspection, Config history and CloudTrail lookup; extend it only with the handful of specific reads a module needs (CloudWatch metrics, `wafv2:GetIPSet`) and probe before assuming.

Only accounts explicitly opted in to the identity sweep in the manifest are swept. An entry that is a narrow role into an account already swept in full is excluded (same account, no IAM read; it only produces denial noise).

## Collection tactics
- Sweep **Identity Center first**, then IAM, so the IAM pass can mark duplicates from this run's data (fall back to the last stored enabled-user set when the IdC sweep is skipped).
- Per IAM user, four reads in parallel (MFA devices, access keys, login profile, groups) with bounded concurrency (~6). `GetLoginProfile` → `NoSuchEntityException` means no console; any other error means *unknown*, not false.
- Emit a **root pseudo-row per account** carrying account MFA posture from `GetAccountSummary`; root is the first finding in most estates and it has no user row otherwise.
- Where `GetAccessKeyLastUsed` is denied, degrade key usage to "denied" and keep reporting key age. Never let a denied detail call drop the user.
- Humans, root and Identity Center rows are exempt from manifest "blessing" (their flags are the triage); service accounts show *unknown* until blessed in the manifest — the unknown list is the triage backlog by design.
- Write through the same snapshot store as every other AWS service: `first_seen / last_seen / gone_at`, TRACKED posture fields (MFA count, console, key age, flags) so a person leaving, MFA dropping or a key appearing lands in the NEW / CHANGED / GONE ledger.

## Normalization & joins
**Roster map.** From the synced roster build: `exact` (every lowercased email or identifier → person + status), `local` (email local-part → person, or `ambiguous` when two people share it), and `byArn` (manual attributions). Match order for an IAM username:
1. **ARN attribution** (manual, authoritative) — a JSON array of IAM user ARNs stored on the person's record in the system-of-record. The roster sync pulls it in; the IAM sync gives it priority over every heuristic.
2. Exact identifier match (username equals a known email or username).
3. Local-part match (`flast` → `flast@…`), **only when unambiguous**.
Anything else is unmatched. First-name accounts with several candidates on the roster are *unauditable by heuristic* — that is precisely what the attribution field exists for.

**Attribution semantics.** An ARN belongs to exactly one person: assigning it removes it from any other record that held it. The UI assign action writes to the system-of-record (the one deliberate exception to read-only), then mirrors locally for immediate feedback; the next roster sync would produce the same result. A one-time idempotent backfill writes every auto-matched ARN so the heuristic is frozen into an explicit attribution and stops drifting. Attributions made directly in the system-of-record flow in on the next sync.

**Human vs service heuristic** for IAM users: console login profile present, or username shaped like a person; everything else is a service account to be blessed.

**Statuses.** OK for an enabled Identity Center user = Active, Coming, Service Account, Preserve. Gone-class = Gone, Suspended, Going.

**Matching, as pseudo-code**

```text
roster = load_roster()            # exact{ident→person,status}, local{localpart→person|AMBIGUOUS}, byArn{arn→person}
for user in iam_users:
    hit = roster.byArn.get(user.arn)                      # 1. manual attribution wins
    hit = hit or roster.exact.get(lower(user.name))       # 2. exact identifier
    lp  = roster.local.get(lower(user.name))
    hit = hit or (lp if lp != AMBIGUOUS else None)        # 3. unambiguous local-part only
    human = user.has_console or looks_like_person(user.name)
    flags = []
    if human and not hit:                    flags += ["orphan"]
    if hit and hit.status in GONE:           flags += ["person-gone"]
    if human and hit and hit.status=="Active": flags += ["legacy-iam"]
    if lower(hit.email) in idc_enabled:      flags += ["dup-idc"]
    if oldest_active_key_days > 365:         flags += ["stale-key-1y"]
    if user.has_console and user.mfa == 0:   flags += ["no-mfa"]
    if user.has_console and (last_login_days is None or last_login_days > 180): flags += ["dormant-console"]
```

```sql
-- the roster map, from the synced identities table
SELECT i.system, i.identifier, i.label, p.name
  FROM identities i JOIN people p ON p.id = i.person_id
 WHERE i.system IN ('*', 'aws-arn');          -- label = 'roster:<Status>'
```

## Signals & finding rules
| Flag | Applies to | Rule |
|---|---|---|
| orphan | IAM human | human-looking user matching nobody on the roster |
| person-gone | IAM, IdC | roster status Gone / Suspended / Going |
| legacy-iam | IAM human | Active person on IAM instead of Identity Center (the migration backlog) |
| dup-idc | IAM human | person also holds an **enabled** Identity Center user — delete-ready |
| stale-key-1y | IAM | active access key older than 365 d |
| no-mfa | IAM, root | console access (or root) without an MFA device |
| dormant-console | IAM | console exists, last login > 180 d or never |
| enabled-off-roster | IdC | enabled user matching nobody |
| enabled-person-gone | IdC | enabled user whose person is Gone / Suspended / Going |

Health: `orphan`, `person-gone`, `no-mfa` degrade the row; the rest are hygiene. Severity order for the report: root no-MFA → orphans with recent console use → gone or suspended with recent login → ancient active keys (ranked by age when usage is blind) → legacy-IAM migration queue → Identity Center hygiene → idle service accounts.

**Migration queue ordering**: *delete-ready* (person already has an enabled IdC user — just delete the IAM user, after confirming no automation rides its keys) before *needs-onboarding* (IAM-only humans). Dormant console users can be disabled immediately regardless.

## Analyst triage & evidence
- Board: account tabs + an Identity Center tab; click-to-filter KPI strip (Humans, Orphans, Person gone, Legacy IAM, Stale keys 1y+, No MFA, Dormant console, Service accounts; IdC: Enabled, Off roster, Person gone, Disabled). Problem rows sort to the top; the full ARN is shown under every username so a reviewer can attribute without leaving the page.
- **Print report**: title block stating the thesis (legacy IAM humans are the pre-Control-Tower population; the goal is zero) → cross-footing summary → attention queue first, in stakes language → Control Tower migration queue → stale keys → full inventories → provenance footer with sync stamps, sources, and the **confessed limitation** on key usage where the role denies it.
- The one-time reconciliation document is the punch list; the module re-derives it on demand. Keep the two consistent: when the first live sweep surfaced exactly the manual findings, that was the acceptance test.
- Export JSON / snapshot / delta through the datasets standard so a quarterly access review is a diff, not a re-read.

**First-reconciliation runbook** (the one-time pass that precedes the module):
1. Map the estate: which accounts hold IAM humans, where Identity Center lives, which roster table is actually the source of truth (lookups may still carry an older table's name).
2. Pull all three datasets read-only (IAM users with MFA/keys/console/last-used, Identity Center users with status, roster with status and email variants).
3. Join IAM usernames → roster by the match order above; join IdC emails → roster; cross-reference IAM humans against enabled IdC users.
4. Rank findings worst first: root MFA, orphans with console use, gone/suspended with recent login, ancient keys, migration queue, IdC hygiene, idle service accounts.
5. State limitations as findings (which calls the read role denied).
6. Write the punch list, then build the module so the second pass is a sync, not a spreadsheet.

**Evidence shape**: `identities[]` (account, arn, type human/service/root/idc, person, person status, mfa, console, last login, key ages, key usage or `denied`, flags, manifest status) · `summary` (counts per flag per account) · `provenance` (sync stamps, profiles used, denied calls).

## Pitfalls & lessons learned
- **Two latent roster-sync bugs decided whether any status flag worked**: the roster REST API returns a single-select as a plain string (the code read `.name`, so Status was never stored), and identity labels were insert-or-ignore (a person going Gone kept their Active label forever). Upsert the label and person id every sync.
- Username heuristics are fragile. Freeze them into explicit attributions as soon as they are reviewed.
- The management account read role can list Identity Center permission sets but be denied identitystore; discover the SSO instance from whichever account can read it and record which.
- Key usage blind under ReadOnly made "ancient active key" rankings by age only; upgrading the profile to SecurityAudit is the fix, CloudTrail queries from a log-archive account the workaround.
- Short-lived production SSO tokens expire mid-session; the sync must fail with a clear banner naming the profile and the re-login command, not with empty results.
- A narrow-role profile into the same account as the full-read profile is a duplicate, not a second account — exclude it from the identity sweep.

## Do not
- Do not sweep identities with an AWSReadOnlyAccess profile and report key usage; report the limitation instead.
- Do not attribute an ambiguous local-part match. Unmatched is a finding; a wrong match is a cover-up.
- Do not store roster status by insert-or-ignore; status changes are the whole point.
- Do not delete-ready an IAM user without checking for key usage or automation dependence (where usage is blind, ask the owner).
- Do not mark Identity Center service accounts as off-roster when the roster says Service Account; that is the blessing model working.
- Do not expose roster record ids, employee names or ARNs outside the control-plane and its evidence exports.

## Related steering files
- analysis-aws-iam-admins — admin-tier flags that reuse this join and the attribution field
- access-reconciliation — the same roster join across SaaS systems
- access-identity-lifecycle — joiner/leaver state rules the Gone/Going statuses come from
- analysis-access-revocations — what happens to these identities at separation
- monitoring-jumpcloud — directory state used for corroboration
- foundation-evidence-datasets-snapshots — export/snapshot/delta for the access review
