---
title: Steering Library — Security Control-Plane Methods
category: foundation
system: cross-cutting
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets]
---
## How this library sits inside AI-RBC-DLC

This directory is the source-side field notebook behind M1 inventory acquisition (`docs/plan.md` §12, M1 row: adapter descriptors, sources-discovery, ingest + mirrors + resolution, reconciliation, attention views). The harness's `inventory/sources.yaml` registry names the feeds a program pulls ("no source, no fact"); these files say how to get good data out of exactly those systems.

- `monitoring-*` and `access-*`: the collection tactics, credential scopes and freshness models that adapter descriptors and `inventory/sources.yaml` entries are written from.
- `analysis-*`: cross-source joins and finding rules; they feed reconciliation and the attention views.
- `foundation-*`: the evidence, triage and privacy doctrine every adapter assumes.

One caveat. `foundation-control-plane-architecture.md` describes a local Postgres single-operator app from the author's prior work. The harness does not adopt it as a system of record: plan decision D1 says everything lives in git. It takes the principles (read-only by default, deterministic first, evidence not verdict, rebuildable vs never-truncated) and treats the app architecture as a reference for an optional adapter-side control plane.

Vendor and product names stay on purpose, per the sanitization stance below. Because this directory sits under `core/steering/`, the leak test (`tests/canaries/forbidden.json`) scans it on every `rbc check`.

# Steering Library — Security Control-Plane Methods

## What a steering file is

A steering file is a distributable Markdown guide that teaches an engineer or an AI agent *how a security team actually did something* — the data sources it pulled, the joins it relied on, the finding rules it wrote, the triage vocabulary it used, and the mistakes it made along the way. It is not product documentation and not a policy. It is the field notebook, cleaned up so another team (or another agent) can reproduce the method against its own tenant.

Every file follows one template: YAML frontmatter, then **Why this matters → Data sources & access method → Collection tactics → Normalization & joins → Signals & finding rules → Analyst triage & evidence → Pitfalls & lessons learned → Do not → Related steering files**. Foundation files adapt the section names (design principles, reference architecture) but keep the frontmatter so the library stays indexable.

Write guidance as instruction with a reason: *"Do X. Because Y."* Tables over prose. Code only for generic shapes (interfaces, pseudo-SQL). Never a tenant-specific query.

## The category scheme

| Category | What the files teach | Typical reader question |
|---|---|---|
| **foundation** | How the control-plane itself is built: architecture, evidence datasets, AI-assisted triage, privacy and secrets. Read these first. | "How do I build the thing that hosts all the other methods?" |
| **monitoring** | One file per telemetry source: how to collect it, what it is good for, which signals matter, how to triage its noise. | "I have Sumo Logic / CrowdStrike / Slack — what do I pull and what does it tell me?" |
| **analysis** | Cross-source analyses that answer a specific oversight question: edge hygiene, EDR coverage, pentest cadence, SSO adoption, escalation health. | "How do I prove X is true across the estate?" |
| **access** | Identity and entitlement reconciliation: who holds what, who should not, lifecycle events, group hygiene, third-party API users. | "Who has access, is it justified, and did it go away when it should?" |

## Vocabulary

Two terms recur in every file. Fix them in your head before reading further.

- **System-of-record** — the authoritative roster of people, devices, and ownership your organization maintains (often a low-code database or HRIS). Every reconciliation in this library joins live vendor state *against* the system-of-record. When they disagree, the disagreement is the finding; the control-plane never silently picks a winner.
- **Control-plane** — the local, single-operator application that pulls from many vendor APIs with read-only credentials, normalizes into one local database, computes deterministic findings, and (optionally) asks a model to interpret them. It is an oversight surface, not an enforcement point. It stores evidence; it does not run your infrastructure.

Supporting terms: **connector** (one file per source implementing a tiny interface), **page dataset** (the sanitized export/snapshot shape every oversight page exposes), **finding** (a deterministic rule hit with a kind and severity), **triage** (the verdict an analyst or model attaches to a finding from a fixed vocabulary), **evidence packet** (the sanitized, budgeted bundle a model receives), **GRC platform** (the compliance tool evidence is pushed to, e.g., Vanta).

## Sanitization stance

These files are meant to leave the building. They therefore contain **no** company name, person name, customer name, tenant or account identifier, repository name, spreadsheet identifier, vault or item name, internal control code, ticket-project key, internal codename, hostname, bucket name, or tenant-specific volume figure. People appear as roles (the security director, the analyst). Numbers appear as qualitative bands ("low volume, a handful per day") unless they are universal design parameters (24h default window, 7-day exfiltration window, 90-day backfill).

Vendor and product names are kept on purpose — Sumo Logic, CrowdStrike Falcon, JumpCloud, Slack, Azure DevOps, Atlassian, Orca, Astra, Google Workspace, 1Password, ThreatLocker, ScreenConnect, AWS, Postgres, Next.js, Anthropic Claude — along with their public API endpoint names, event type names, and index names. Those are the reusable part. Tenant-specific source-category naming is not.

If you fork a file and add tenant detail, keep the fork internal and strip it again before redistribution.

## How to use the library

1. Read the four foundation files in order. They define the architecture, the evidence standard, the triage discipline, and the safety floor every other file assumes.
2. Pick the monitoring file for each source you already have. Wire the connector. Confirm the signals listed under *Signals & finding rules* appear in your own data before building anything on top.
3. Pick the analysis and access files that match the oversight questions your program must answer. Each names its inputs; most need two or more monitoring sources plus the system-of-record.
4. For every new page, follow the *page dataset* recipe in `foundation-evidence-datasets-snapshots.md` so Export, Snapshot, History, Deltas, and the analyst report arrive for free.
5. Treat *Do not* sections as hard constraints. They are the mistakes that cost a day or produced a wrong finding.

## Reading order for an agent

An agent asked to "stand up oversight for system X" should load, in order: this README (vocabulary and constraints), `foundation-control-plane-architecture.md` (the connector contract it must implement), `foundation-privacy-safety-secrets.md` (the credential scope it must request and the data it must never fetch), the `monitoring-X.md` file for the source, then whichever `analysis-*` or `access-*` file matches the question. Load `foundation-evidence-datasets-snapshots.md` before writing the page, and `foundation-ai-analyst-triage.md` only if a model will interpret the result.

## Library index

| File | Category | Hook |
|---|---|---|
| `README.md` | foundation | This index: template, categories, vocabulary, sanitization stance. |
| `foundation-control-plane-architecture.md` | foundation | Local single-operator control-plane: connector interface, normalized event shape, module registry, schema split, read-only by default. |
| `foundation-evidence-datasets-snapshots.md` | foundation | The page-dataset standard: entity vs state hash, hash-chained snapshots, deltas, analyst evidence, GRC push. |
| `foundation-ai-analyst-triage.md` | foundation | Deterministic stats first; persona-based agentic triage; fixed vocabularies; terse output; every assessment saved. |
| `foundation-privacy-safety-secrets.md` | foundation | 1Password secret references, read-only audit-scoped credentials, blur-not-hide screen-share privacy, HR/legal gate, localhost-only DB. |
| `monitoring-sumologic.md` | monitoring | Search Job API as the universal collector; narrow windows to control credit burn; collector freshness as a control. |
| `monitoring-siem-insights-triage.md` | monitoring | Cloud SIEM insight workbench: entity anchoring to the IdP, persona triage, dismissal write-back with tuning notes. |
| `monitoring-crowdstrike.md` | monitoring | Falcon Event Streams for console/auth/API audit; Hosts API for sensor truth; DLP detections as a local-only queue. |
| `monitoring-jumpcloud.md` | monitoring | Directory Insights for admin and SSO auth events; user and system inventories; the string-typed `success` gotcha. |
| `monitoring-slack.md` | monitoring | Enterprise audit log; the missing `client_msg_id` tell for tool-posted messages; app and MCP tool-call provenance. |
| `monitoring-aws-cloudtrail.md` | monitoring | Direct `LookupEvents` per account; capture `userAgent`; STS/SSO credential refresh per run; attribution joins. |
| `monitoring-atlassian.md` | monitoring | Org audit-log API as the workaround for license-limited visibility; admin and content actions. |
| `monitoring-azure-devops.md` | monitoring | Org audit stream for human actors; PAT lifecycle; commits and PRs as the activity truth for source control. |
| `monitoring-google-workspace.md` | monitoring | Drive ACL/visibility changes itemized, reads rolled up hourly; Gmail tripwires only — never the delivery trace. |
| `monitoring-orca.md` | monitoring | Tenant audit log for who-did-what in the CNAPP; shift-left scan logs; serving-layer queries for coverage. |
| `monitoring-screenconnect-rmm.md` | monitoring | RMM console security events; client version floors per node when the CVE is in the client. |
| `monitoring-1password.md` | monitoring | Vault and item access events as an exfiltration signal in separation windows; secret references, never values. |
| `monitoring-threatlocker.md` | monitoring | Action log straight from the Portal API; healthy fleet equals zero denies; which policy fired on which device. |
| `analysis-aws-waf-edge.md` | analysis | ALB listener and WAFv2 rules in priority order; shadowed rules, Count-mode overrides, unprotected front doors; change ledger. |
| `analysis-aws-iam-admins.md` | analysis | IAM users and Identity Center accounts reconciled to the roster; orphans, leavers, legacy humans, stale keys, missing MFA. |
| `analysis-aws-identity-reconciliation.md` | analysis | Roles: who can assume (trust policy), when last used (IAM), who actually assumed (CloudTrail). |
| `analysis-access-revocations.md` | analysis | Separation watch: 7-day exfiltration score across Drive, Gmail, Slack, DevOps, DLP, IdP; pre/post briefs. |
| `analysis-actor-automation-fingerprints.md` | analysis | Sub-second cadence, bursts, user-agents, token-vs-SSO: evidence of *how* work is done, never a verdict on *why*. |
| `analysis-edr-coverage.md` | analysis | System-of-record device chain joined to live Falcon and JumpCloud state; coverage %, finding kinds, exemptions. |
| `analysis-endpoint-fleet-inventory.md` | analysis | Field and cloud-edge fleets across RMM and MDM; hardening checks; capability floors; snapshot diffs. |
| `analysis-source-control-azure-devops.md` | analysis | Who can touch a repo versus who commits; stray git emails; roster reconciliation; evidence pack. |
| `analysis-shift-left-adoption.md` | analysis | Scanner logs per repo and person versus the repo estate; PR-stage versus CLI scans; weekly secret-warning trend. |
| `analysis-pentest-cadence.md` | analysis | Pentest program as a control: cadence table per product, scheduled scans running, every finding ticketed. |
| `analysis-issue-escalations.md` | analysis | Escalation chain health: source ticket → target board → clone; handoff hygiene; due-date board; non-escalation hygiene queue. |
| `analysis-ai-dev-lifecycle.md` | analysis | AI coding harness as executable content: manifest with content hashes, append-only change log, adoption by consumer repo. |
| `analysis-sso-adoption-metrics.md` | analysis | Director metrics from the SSO auth feed: adoption %, MFA %, managed-device %, dead apps, bound-but-unused users. |
| `analysis-saas-settings-baseline.md` | analysis | Settings checklist × scanner results; target-state column; scanner "compliant" is a floor, not the bar. |
| `access-atlassian.md` | access | Site and product access versus roster; license bleed; admin recertification. |
| `access-reconciliation.md` | access | License bleed and violations across system-of-record, IdP, Atlassian, Google, Slack — joined on email, rule-based. |
| `access-identity-lifecycle.md` | access | Joiner/mover/leaver state rules across HR form, IdP, Google; offboard requests; access review report. |
| `access-groups.md` | access | Static versus dynamic IdP groups; groups still holding leavers; privileged-group scrutiny; one-click cleanup with confirm. |
| `access-export-api-users.md` | access | Third-party data-export API register synced from a spreadsheet; secret columns never requested; removed-since-last-sync. |

## Conventions inside a file

Readers — human or agent — should be able to skim any file the same way. Authors keep to these conventions:

| Section | What belongs there | What does not |
|---|---|---|
| Why this matters | The oversight question, and why a console or a SIEM alone does not answer it. Two or three paragraphs at most. | Product marketing, history of the team. |
| Data sources & access method | Each source, the API or export used, the credential scope required, the freshness model (live, snapshot, import). | Tenant identifiers, source-category names, volumes. |
| Collection tactics | Windows, caps, pagination/bisection, cursors, backfill length, partial-failure handling. | Code longer than a few lines. |
| Normalization & joins | The entity key, the fields kept, the join to the system-of-record or roster, how disagreement is represented. | A schema dump. |
| Signals & finding rules | Every finding kind with its rule stated as a sentence, its severity, and the field it keys on. Tables. | Vague "look for anomalies". |
| Analyst triage & evidence | The fixed triage vocabulary, the output contract, what the evidence export contains, what is pushed to the GRC platform. | Prompt text in full. |
| Pitfalls & lessons learned | Each a one-liner: what went wrong, what fixed it. Dated internally, undated here. | Complaints without a fix. |
| Do not | Hard constraints, imperative mood, one per line. | Soft preferences. |
| Related steering files | Slugs with a half-line reason to follow the link. | Everything else. |

Agents consuming a steering file should treat *Signals & finding rules* and *Do not* as executable constraints, and *Collection tactics* as the default parameters to start from. When a file and the live tenant disagree, the tenant wins — and the disagreement goes into *Pitfalls* on the next edit.

## Maintaining the library

- A file is `maturity: field-tested` only when the method ran against a real tenant and produced findings that survived review. Drafts say `draft`.
- When a method changes, edit the file in place and add a line to *Pitfalls & lessons learned*. Do not fork versions.
- Keep `related:` lists bidirectional. If A cites B, B cites A.
- Re-run the sanitization checklist in this README before every redistribution. One leaked identifier retires the whole library's trust.
