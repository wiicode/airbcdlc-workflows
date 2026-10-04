---
title: Shift-Left Adoption and CNAPP Oversight — scan-log adoption, coverage gaps, deterministic alert tiers, GRC evidence
category: analysis
system: Orca Security (Shift Left scan logs, Serving Layer) + AWS inventory + Azure DevOps repos
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, monitoring-orca, analysis-source-control-azure-devops, analysis-endpoint-fleet-inventory, analysis-aws-waf-edge, analysis-issue-escalations]
---
# Shift-Left Adoption and CNAPP Oversight — scan-log adoption, coverage gaps, deterministic alert tiers, GRC evidence

## Why this matters
A CNAPP is the system of record for cloud posture and code findings, but its console does
not answer the *oversight* questions a security lead owes the business: is the scanner
actually adopted across every repository at the PR stage, where are the coverage holes
(repos, images, instances, accounts), which of the thousands of alerts truly need a ticket,
and can the evidence reach the GRC platform without a human re-exporting it each quarter?

Three objectives drive the module:
1. **Shift-left adoption** — every active repo is scanned at PR time; developers see
   findings before merge. A fleet CLI with a service token, if adopted, becomes a second
   adoption marker.
2. **AppSec + CSPM coverage gaps** — each item of the gap analysis becomes a standing panel
   (denominator / covered / gap) instead of a one-off spreadsheet; the CSPM owner's CSVs
   are a row-level reconciliation key, not the product.
3. **Evidence fast path** — every panel is a plain CSV and the page dataset a sanitized
   JSON envelope, pushable to the matching GRC control.

Constraint learned early: the vendor's AI/MCP layer ran out of credits and is not
reproducible evidence. **API-only, deterministic counts, AI never in the evidence path.**

## Data sources & access method
| Endpoint | Table | Notes |
|---|---|---|
| `GET {base}/shiftleft/scan_logs/?limit=300&start_at_index=N` | `scan_logs` | trailing slash required (301 otherwise); max 300/page; only `start_at_index` paginates; newest first; log retention ~90 days |
| `GET {base}/shiftleft/projects/` | `sl_projects` | scanner projects (squad buckets): scan types enabled, warn/block mode, CLI suppression flags |
| `POST {base}/serving-layer/query` | alerts, VMs, images, cloud accounts, attack paths, crown jewels | `{query:{models:[M],type:"object_set",with?:{…}}, select?, limit≤1000, start_at_index, get_results_and_count:true}`; fields wrapped as `{value}`; bursts → 429, space ~1.1–1.5 s |
| `GET {base}/cloudaccount` | `cloud_accounts` | **payload embeds presigned onboarding URLs with STS session tokens** — whitelist stored fields |
| `GET {base}/integration_configs` | `integrations` | connected integrations; no last-success timestamp |
| Repo estate | `repos` from the source-control module | denominator for adoption and coverage |
| AWS inventory (read-only) | EC2, ECR, ECS, Organizations, SGs, ELBv2 listeners/targets | denominators + the port-reachability gate |
| AWS Trusted Advisor (Support API) | `ta_checks`, `ta_flagged_resources`, `ta_changes` | Security Hub control results surface here when the CNAPP's compliance endpoints are deprecated |
| GRC platform documents API (e.g., Vanta) | — | `POST /v1/documents/{id}/uploads` (multipart) + submit; needs a manage token with upload scope |

Deprecated or empty on recent tenants: `GET /api/alerts` (405), `compliance/frameworks/*/stats|tests` (405), several SVL compliance models (0 rows). Discover with `serving-layer/schema` (large; discovery only).

## Collection tactics
- **One full backfill, then incremental**: page from newest until a page's oldest
  `scan_time` is older than max-stored minus 1 h; upsert by id. Until a `backfill_done`
  flag is set in connector state, every run walks the whole log so an interrupted first
  run cannot leave a hole. Honour `Retry-After`, ~150 ms between pages, one sync per
  process. Record pages, fetched/inserted/updated, oldest/newest per run.
- **Never store a credential**: the scan log's `api_token` object is metadata — keep
  `{id, name, service_token}` only. Secret alerts' `match` / `code_snippet` hold partially
  masked material — never stored.
- **Alerts via the Serving Layer**: open critical+high as rows (status open/in_progress);
  medium/low as **counts only** by category, once a day. Pull attack paths (their
  `Priorities` map alert ids to the paths they fix), snoozed/dismissed/closed with
  `StatusTime` for exceptions and the dismissal sample.
- **Network inventory sweep** (read-only, per account, deduplicated by account id):
  security-group rules, instance↔SG, LB listeners/rules/target groups/health (targets only
  on internet-facing LBs), ECS service ports and task definitions. Replace each successfully
  swept account+region in one transaction; an expired session stops the run, an
  unconfigured profile is recorded as that account's error.
- **Idempotent findings sync** (upsert by alert id). When an alert leaves the open set,
  stamp `closed_at` + `closed_status` (dismissed / closed / snoozed / downgraded / gone);
  **refuse to close anything on a short read**. Count reappearances as `reopened`.

## Normalization & joins
- **Scan classification** (deterministic): PR scan = `run_by.origin = git` + `code_review`
  label; token/CLI run = `api_token` present OR `origin = user` without `scheduled_scan`;
  scheduled = `scheduled_scan` label (origin `user` but not a person); push = everything
  else; secret warning = `scan_type = file_system_secret_detection` ∧ `status = warning`.
- **Repo join**: parse `<org>/<Project>/<Repo>` from `repository.name`, match the repo
  estate case-insensitively on project + name. Denominator = repos not gone, not disabled.
  Repos renamed keep the old name in older scan rows until rescanned.
- **People join**: scan author (token runs fall back to `run_by`, then token name) resolved
  through the source-control identity ladder (manual → exact alias → collision-safe
  local-part). Squad = squads of the scanner projects the scans ran under, mapped through a
  squad-routing config; raw project name when unmapped.
- **Coverage items** (each with Denominator / Covered / Gap and the rule in
  `context.definitions`): repos registered or scanned (per scan type in 30d); container
  registry repos with a latest tag whose image carries `full_scan_time`; running container
  services' images matched to a `container_image` scan by exact registry then any; compute
  instances present in the CNAPP `Vm` model with an OS and a full scan (OS falls back to
  the systems manager; end-of-support falls back to a static table); active org accounts ∪
  connected accounts outside the org, covered when connected and online.
- **FSBP weak spots** from Security Hub results via Trusted Advisor when the CNAPP's
  per-control endpoints are gone: score per service prefix = passed ÷ (passed + failed); a
  control fails when flagged in any account; verdict/reason columns left blank for a human.

## Signals & finding rules
**Alert tiering** — one tier and one machine-readable reason per alert; every gate kept
for the drill-down. Pure, no I/O, no AI.

| Category | fix-now | scheduled | monitor / soc |
|---|---|---|---|
| Secrets | Valid ∧ in current tree ∧ not a test file | Valid but only in git history (rotate, no code change) | test file, or not verified valid |
| Host / container vulns | **all of**: CVSS AV:N, exploit exists, exposure Internet/Public Facing, prod-class account, **vulnerable service port internet-reachable** | any gate fails: `local-vector`, `no-known-exploit`, `not-internet-facing`, `non-prod-account`, `vulnerable-port-not-exposed`, `no-internet-reachable-port`, `library-no-reachable-port`, `reachability-unknown` | — |
| SCA (code deps) | never, until a repo → internet-facing-service map exists | fix available | no fix |
| SAST | never (same gap) | Confidence = High ∧ Impact = High | below threshold |
| CSPM posture | alert is a fix point of an **open High/Critical attack path** | default | — |
| Suspicious / malicious activity | — | — | soc (a detection, not a vulnerability) |

**Port-reachability gate**: asset-level "Internet Facing" is not enough. Reachable means
ingress from `0.0.0.0/0` or `::/0` on a public-IP instance, or an internet-facing LB
listener open to the internet forwarding to that port. Specific external /32s do not
count. Map services to default ports (search 9200/9300, kibana 5601, web 80/443, ssh 22,
mongo 27017, redis 6379, rabbit 5672/15672) with specific libraries matched before the
servers whose names they contain. Local-vector CVEs never promote through exposure. A
library (OpenSSL, glibc, log4j) counts as reachable only when some service port on the
asset is; for a container, when its service sits behind a public LB. **Unknown
reachability is never promoted.**

**Work items**: group by secret fingerprint (`finding_hash`), by CVE × account × asset
group (ASG, cluster, image repo or name prefix), or by rule × repo. Route by Owner tag /
repo ownership; unrouted items are their own list.

**Crown-jewel caveat**: the CNAPP auto-detects hundreds of "crown jewels"; until the team
confirms them they are recorded and **not** used to promote posture alerts. Make the
decision explicit in the policy document.

**Adoption flags per repo**: not scanned 30d · not in repo estate · no PR scans ·
secret-detection warnings (highlighted). KPIs with prior-window deltas: scans 7d/30d,
repos scanned vs active, token/CLI runs (API-token vs user-run), distinct authors.

## Analyst triage & evidence
- **Policy document in prose + rules in one code file**, kept in step; the SLA table
  (fix-now 30d per PCI 6.3.3 draft; scheduled 90d) marked pending until confirmed. The SLA
  clock starts at the alert's `CreatedAt`; for secrets show the first-commit date beside it.
- **Exceptions live in the CNAPP** (snooze/dismiss with owner, reason, expiry); no local
  dismiss. Open-exception count = snoozed critical+high.
- **Monthly dismissal sample**: 20 random alerts dismissed/closed in the prior 30 days,
  seeded by month so auditors can reproduce the draw. The API does not expose who changed
  status — fill "who" from justification text or last commenter, else n/a.
- **Reporting cadence**: squads weekly with **fix-now items only**; leadership monthly with
  four numbers and trend (new fix-now/week, median age and time-to-close vs SLA, overdue,
  open exceptions); auditors via CSV evidence sources (fix-now, reasons, dismissal sample,
  monthly) plus the dataset.
- **GRC push**: register each dataset and CSV as an evidence source with freshness from the
  last sync; link a GRC document from the page's rail, preview, push manually once, then
  allow auto-push after sync-all. While a backfill is incomplete the dataset is marked
  `incomplete` and auto pushes are **skipped and recorded**, not sent.
- Field names avoid sanitizer-denied segments (`api_run_*`, `sd_*`).

## Pitfalls & lessons learned
- Scheduled scans carry `origin = user`; exclude them from "user/CLI-run" or adoption
  inflates.
- `issues_by_priority` is only populated on warning scans — counts are per scan status,
  not per finding.
- CI image scans may run only against a non-prod registry's `develop` tags while
  production runs `:latest` from a different registry — the coverage panel exposes it
  only if you join on exact registry first.
- A repo count that differs from the CSPM owner's spreadsheet is usually **PAT
  visibility** (repos the token cannot read) or a counting basis, not a stale sync — check
  per-project counts before changing the sync.
- The CNAPP cannot say who dismissed; do not promise that metric.
- Stage/dev accounts without a local profile resolve as `reachability-unknown`; add the
  profiles or accept that their alerts are scheduled by default.
- TLS terminated at the LB still counts the backend library as reachable under the rule;
  review such items by hand.

## Do not
- Do not use the vendor AI/MCP output as evidence or in counts.
- Do not store `api_token` secrets, presigned onboarding URLs, or secret match snippets.
- Do not promote an alert on asset-level exposure alone, or on unknown reachability.
- Do not promote on auto-detected crown jewels until the team confirms them.
- Do not close findings from a short or partial read.
- Do not auto-push an incomplete dataset to the GRC platform.
- Do not build an alert inventory for medium/low — counts only; alerts stay in the CNAPP.

## Related steering files
- monitoring-orca — connector details and rate limits
- analysis-source-control-azure-devops — repo estate, branch-policy scanner gates
- analysis-endpoint-fleet-inventory — OS end-of-support table
- analysis-aws-waf-edge — web ACL inventory joined to FSBP WAF controls
- analysis-issue-escalations — the ticket chain fix-now items flow into
- foundation-evidence-datasets-snapshots — evidence sources and GRC push gates
