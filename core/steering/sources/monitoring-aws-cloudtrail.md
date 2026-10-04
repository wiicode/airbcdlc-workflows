---
title: AWS CloudTrail — direct LookupEvents per account
category: monitoring
system: AWS CloudTrail
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, analysis-actor-automation-fingerprints, analysis-aws-iam-admins, analysis-aws-identity-reconciliation, analysis-aws-waf-edge, monitoring-sumologic, access-identity-lifecycle]
---
# AWS CloudTrail — direct LookupEvents per account

## Why this matters
CloudTrail is the only complete record of who touched the AWS control plane. Most teams
route it to a SIEM and query it there, and that is the right long-term home. But a SIEM
partition can break silently (collector misconfigured, S3 notification lost, parser
drift) and the gap is discovered weeks later during an investigation. The control-plane
keeps a **second, independent read path**: it calls `LookupEvents` directly against
every account with an audit-grade read role. The direct path is narrow (management events,
90-day lookback, slow API) but it is always truthful and it carries the one field the
SIEM-normalized copy tends to drop — `userAgent`, the best automation fingerprint there is.

Two distinct consumers share the same pull:
- The **events stream** (one normalized row per API call) feeding actor×source matrices,
  per-person activity review, and offboarding signals.
- The **per-account activity rollup** (summary tiles: events, distinct actors, notable
  events, top services, top actors) that answers "what is happening in the log-archive
  account right now" without opening the console.

## Data sources & access method
| Source | Method | Notes |
|---|---|---|
| CloudTrail management events | `cloudtrail:LookupEvents` per account/region | 90-day lookback; management events only; ~1–2 requests/s; `MaxResults` 50 |
| Caller identity | `sts:GetCallerIdentity` once per refresh | Records account id + role actually used; auth failure here marks the account unreachable instead of throwing |
| Account roster | one JSON env var listing accounts | Shared by the CloudTrail connector and every AWS inventory sync; adding an account there is enough |

**Role choice is load-bearing.** Use the AWS managed `SecurityAudit` policy (or a
permission set built on it) for every read profile, never `ReadOnlyAccess`/`ViewOnlyAccess`.
ReadOnly denies several things the oversight modules need (`iam:GetAccessKeyLastUsed`,
credential reports, `health:Describe*`); SecurityAudit allows them plus
`cloudtrail:LookupEvents`. Extend the permission set only with named read actions that
SecurityAudit lacks for your modules (e.g. `cloudwatch:GetMetricData`, `wafv2:GetIPSet`).

**Credential strategies** — each account entry picks exactly one, resolved fresh per run:
1. **STS AssumeRole**: `{ roleArn, sourceProfile, externalId?, durationSeconds? }` — base
   credentials come from the source profile, then `sts:AssumeRole` into the target.
2. **Named / SSO profile**: `{ profile }` — relies on the local credential file.
3. **Ambient chain**: `{}` — env vars / default chain (CI, containers).

Set `ignoreCache` on the provider chain: the SDK memoizes `~/.aws` contents per process,
so a long-running local server would otherwise never see a re-authenticated session.
Keep one login helper that refreshes every control-plane profile in a single device-auth
flow and fails fast on the first missing role; surface its name in every STS error message.

## Collection tactics
- **Window**: default 24h, cap at a few weeks; `LookupEvents` cannot see past 90 days anyway.
- **Per-account cap**: stop paging at a fixed event ceiling (low thousands) per run. The API
  is slow; a busy account will not finish a wide window inside a request timeout. Prefer
  frequent narrow pulls over rare wide ones.
- **Partial failure is normal**: one account's expired session must not zero the run.
  Collect errors per account; throw only when every account failed; otherwise log and
  return what you got. Record `reachable=false` plus the STS hint on the account's
  metadata row so the UI shows exactly which profile needs re-login.
- **Sequential sync-all**: when one button syncs every AWS target (per-account CloudTrail
  pulls, then each inventory service in registry order), run them **sequentially**. They
  share a DB pool and write overlapping tables; parallel transactions contend. Each target
  is timed and failure-isolated; the response lists every target with ok/error/ms.
- **Transaction scope**: wrap a whole paged pull in one transaction so dataset readers on
  a read-only connection never observe a half-ingested batch.
- **Idempotent upsert** keyed on `(account, EventId)`; fall back to `eventName:eventTime`
  when `EventId` is missing.
- Store the raw `CloudTrailEvent` JSON (truncated to a few KB) alongside the parsed columns;
  the parsed set is deliberately small and the raw copy answers the next question.

## Normalization & joins
Parse `CloudTrailEvent` (a JSON string inside the record) — the top-level `Username`
field is not enough.

| Normalized field | Derivation |
|---|---|
| `actor` | `userIdentity.userName`, else last ARN segment (assumed-role **session name**), else `sessionContext.sessionIssuer.userName`, `root` for Root, source IP / `invokedBy` for `AWSService` |
| `actor_type` | map `userIdentity.type` → `iam-user` / `assumed-role` / `service` / `root` / `federated` (WebIdentity, SAMLUser) / `unknown` |
| `action` | `EventName` |
| `target` | joined `Resources[].ResourceName`, else `EventSource` |
| `source_ip`, `region` | `sourceIPAddress`, `awsRegion` |
| `detail` | compact `flag=<reason> ua=<userAgent, first ~80 chars> error=<errorCode>` |
| `source` | `aws:<account-label>` so the UI can filter one account or `aws:*` |

**Actor → person**: resolve through the roster ladder (explicit ARN attributions held in
the system-of-record → exact alias → collision-safe local part). Assumed-role session
names from SSO usually equal the person's email; service roles resolve to nothing and
should be labelled as automation, not left "unmapped".

**Role usage join**: the events table doubles as the observed-`AssumeRole` source for the
IAM roles module (role ARN in `target`, caller + user agent in `detail`).

## Signals & finding rules
A single `notableReason()` function, in one file, in priority order:

| Flag | Rule |
|---|---|
| `cloudtrail-tamper` | `cloudtrail.amazonaws.com` + `StopLogging` / `DeleteTrail` / `UpdateTrail` / `PutEventSelectors` — highest priority, especially in the log-archive account |
| `root-usage` | any event with `userIdentity.type = Root` |
| `iam-write` | IAM `Create*/Delete*/Attach*/Detach*/Put*/Update*/Add*/Remove*` touching AssumeRolePolicy, AccessKey, User, Policy, Role, Group, LoginProfile, MFADevice |
| `console-login-failed` / `console-login-no-mfa` / `console-login` | `ConsoleLogin` with `responseElements.ConsoleLogin=Failure`, or `additionalEventData.MFAUsed != Yes` |
| `sg-change` | `AuthorizeSecurityGroup*`, `RevokeSecurityGroupIngress`, `ModifySecurityGroup*` |
| `kms-destroy` / `secret-destroy` | `ScheduleKeyDeletion`, `DisableKey`, `DeleteAlias`; `DeleteSecret`, `DeleteResourcePolicy` |
| `log-bucket-tamper` vs `s3-policy-change` | S3 bucket policy/ACL/logging/versioning/lifecycle/delete; escalate when the bucket name matches your log-archive naming convention |
| `access-denied` | `errorCode` is `AccessDenied` or `Client.UnauthorizedOperation` — spikes surface in the summary |

**Automation fingerprint** (shared regex with the events page): `ua=` matching
`aws-sdk|boto|python|aiohttp|okhttp|go-http|node|axios|curl|libcloud|sdk|agent`.
Combine with cadence stats (sub-second pairs, bursts, off-hours %) computed
deterministically — see analysis-actor-automation-fingerprints.

Offboarding signal: for a departing person's aliases, `GetSecretValue` and `GetObject`
are weighted highest; `Create*/Delete*/Put*/Attach*/Assume*` are context.

## Analyst triage & evidence
- Per-account page: tiles (events, distinct actors, notable), top services, top actors,
  then the notable list and the full stream. Keep `window_hours` in the payload so a
  snapshot is self-describing.
- Evidence export = the account summary + notable events as a dataset snapshot; the raw
  stream is not exported (volume, and the `detail` field can carry resource names).
- Triage vocabulary for notable events: EXPECTED (named automation/role) · RECERTIFY
  (human admin action with a ticket) · INVESTIGATE (no owner) · BROKEN (access-denied
  spike from a control-plane profile — a permissions regression, not an attack).
- AI commentary, if used, interprets the deterministic stats only; it never decides
  what is notable.

## Pitfalls & lessons learned
- The SIEM partition for CloudTrail was broken for an extended period before anyone
  noticed; the direct path exposed it. Treat "both paths agree" as a collector health check.
- `LookupEvents` is management-events only — no S3 data events, no Lambda invokes. Say so
  on the page.
- A scoped role that exists only for one narrow job must be excluded from the general
  inventory sweep (`skipServices`), or it produces guaranteed access-denied noise that
  reads like a real finding.
- Root MFA disabled on an account was found through an unrelated identity reconciliation,
  not through CloudTrail. Pair this feed with the identity modules.
- Two account entries can point at the same account id (different roles). Deduplicate by
  account id in sweeps that must not double count.
- Expired SSO sessions are the number-one operational failure. Make the error message name
  the profile and the exact re-login command.

## Do not
- Do not use `ReadOnlyAccess` for control-plane read profiles.
- Do not log credentials, STS tokens, or full `CloudTrailEvent` payloads at debug level.
- Do not run per-account pulls in parallel against a shared local DB.
- Do not let an AI model classify events as notable; rules live in one reviewed function.
- Do not store account ids, role ARNs, or bucket names in exported evidence; export the
  account label and the flag.

## Related steering files
foundation-control-plane-architecture · analysis-actor-automation-fingerprints ·
analysis-aws-iam-admins · analysis-aws-identity-reconciliation · analysis-aws-waf-edge ·
monitoring-sumologic · access-identity-lifecycle
