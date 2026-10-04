---
title: AI-Assisted Development Lifecycle Oversight — harness integrity, adoption, coverage contract
category: analysis
system: Azure DevOps repos + AI coding assistant steering files
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, analysis-source-control-azure-devops, analysis-shift-left-adoption, monitoring-azure-devops]
---
# AI-Assisted Development Lifecycle Oversight — harness integrity, adoption, coverage contract

## Why this matters
When developers code with an AI assistant, the steering documents, skills and agent
configurations that guide it are **executable content that happens to be prose**. They
grant and remove guardrails the way code does: a modified safety rule is the same class of
event as a deleted firewall rule. Most organizations distribute them from a standards repo
and never look again.

The compliance question is "what is steering our coding agents, and is it intact?" Four
concerns map to four panes: integrity of the harness (manifest + change log), what the
harness leaves out (a coverage contract scored by an external analysis), traceability to
controls, and proof that the harness actually ran on a session (a later phase). The
control-plane is **system of record and verifier**; it never runs the coverage analysis
itself and never lets the analyzer define its own rubric.

## Data sources & access method
| Source | Pull | Yields |
|---|---|---|
| Standards repos (steering docs, skills, agent configs) | repo REST: resolve default branch from metadata (never assume `main`), recursive item list, per-file content | sha256 + full text per file, blessed commit per repo |
| Every live repo in the org | projects → repos → root one-level listing; recurse the assistant's config directory only when present | presence of `AGENTS.md`, `CLAUDE.md`-style root files, steering file count, **shadows** |
| Coverage contract (local JSON) | file in config | version, domains with expectation, signals, `satisfies[]` control tags |
| External coverage analysis | JSON uploaded or POSTed | per-domain verdicts with evidence quotes |
| SIEM repo audit stream | `Git.RefUpdate*` on the standards repos | who changed the harness and when (future wiring) |

Same read-only token as the source-control module (Code: Read). Tables: `files`,
`changes` (append-only), `adoption`, `analyses`, `sync_runs`, all with the standard
`first_seen / last_seen / gone_at` lifecycle.

## Collection tactics
- **Standards sweep**: content-hash every file at the default-branch HEAD; store the full
  text (the repos are small) so the analysis packet can carry it verbatim. Record the HEAD
  commit as the **blessed commit** in connector state.
- **Change log**: diff against the previous manifest into `baseline / new / modified /
  removed`, append-only. A modified safety/security/execution-control doc is a high-signal
  row.
- **Adoption sweep**: for every live repo, one root listing; count steering files;
  empty/unreadable repos record as not-adopted and never fail the sweep. Zero-repos guard
  refuses tombstoning.
- **Shadow detection**: a repo-local steering file whose basename matches a *global*
  standards steering doc — the weakening vector the standards README forbids but nothing
  enforces. Name match first; content diff against the global original is the follow-up.
- **Packet endpoint**: one GET returns contract + pinned commits + full harness file
  contents + run instructions. This is the **only** input the external analyzer should
  consume.
- **Ingest, don't reject**: validation problems are recorded on the analysis row
  (`status = invalid`) with each problem named — a malformed run is still evidence that a
  run happened.

## Normalization & joins
- **Coverage contract shape** (`kind`, `version`, `updated`, `_about`, `_verdicts`,
  `domains[]`): each domain has `id`, `title`, `expectation` (what agents must do),
  `signals[]` (phrases an auditor would look for), `satisfies[]` (control/TSC/contract
  clause tags, filled as the trace matrix lands). Representative domains: secrets handling,
  injection defense, authn/authz, independent review, data privacy, dependency provenance,
  external content, test evidence, change approval, mode discipline, repair limit,
  logging/telemetry, infrastructure config.
- **Analysis document contract**: `kind = "aidlc-coverage-analysis"`, `schema_version`,
  `repo`, `analyzed_commit`, `contract_version`, `ran_at`, `runner {harness, coordinator,
  personas[]}`, `domains[{id, verdict: covered|partial|silent, evidence[{file, quote}],
  gaps, persona}]`, `regressions[]`, `summary`.
- **Validation rules**: every contract domain must have a verdict (silence is declared,
  never implied); unknown domain ids are problems; `covered`/`partial` require verbatim
  quotes with file paths; `partial` must name the gap.
- **Staleness at read time**: the coverage matrix is `fresh` only when `analyzed_commit`
  equals the blessed commit; otherwise a STALE banner — the verdicts describe a harness
  that has since changed.
- **Adoption row per repo**: project, repo, root-file flags, steering count, shadows JSON,
  lifecycle columns; joins to the repo estate and (through it) to branch-policy posture.

## Signals & finding rules
| Signal | Rule | Triage |
|---|---|---|
| Harness file modified | manifest hash changed for a steering/skill/agent file | REVIEW diff; safety/security/execution-control docs are high |
| Harness file removed | present in previous manifest, absent now | INVESTIGATE |
| Repo shadows a global guardrail | local steering basename ∈ global steering names | DIFF content; payment/auth repos first |
| Repo not adopted | no root agent file and no steering directory | RECORD (adoption %) |
| Domain silent | analysis verdict `silent` | GAP — the harness says nothing about it |
| Domain partial | verdict `partial` with named gap | PLAN — close the gap in the standards repo |
| Analysis stale | `analyzed_commit ≠ blessed commit` | RERUN the external analysis |
| Analysis invalid | missing domains, unknown ids, quotes absent | RECORD — still evidence, flagged |
| Endpoint integrity unverifiable | distribution is by workstation symlink; no attestation hook | state it as **unverifiable**, not green |

**Scoring**: adoption % = repos with harness files ÷ live repos; coverage = covered /
partial / silent counts over contract domains, with trend by analysis; integrity = days
since last harness change and count of unreviewed changes; shadow count by repo
sensitivity. Report each as its own tile; never blend them into one "AI safety score".

## Analyst triage & evidence
- The **external analysis harness** (a multi-persona AI runner: security, test, business
  analyst lenses) produces the coverage JSON; diverse lenses reduce single-persona blind
  spots. The control-plane stores every run, valid or not, with the commit it examined.
- **Evidence set**: manifest (file, hash, size, commit), change log, adoption table,
  coverage matrix with quotes, the packet itself, and the analysis JSON. Export JSON /
  snapshot / history through the page dataset standard; headline metrics adoption %,
  silent domains, shadows, unreviewed changes.
- **Vocabulary**: REVIEW / INVESTIGATE / DIFF / RECORD / GAP / PLAN / RERUN / EXPECTED.
- **Trace matrix**: fill `satisfies[]` per domain with internal control ids and framework
  criteria so each silent domain maps to a control weakness statement.
- **Phase 2/3 roadmap** (state it in the evidence so auditors see the plan): PR
  spec-artifact gate in consumer repos (spec mode leaves requirements/design/tasks +
  evidence; a "mode escape" to free-form drops guardrails) and a workstation attestation
  hook that stamps clone SHA + dirty state into PR output.

## Pitfalls & lessons learned
- The harness executes from workstations (symlinked home directories), not from the repo;
  repo-side checks can never prove what steered a session, and a setup script may silently
  preserve pre-existing local agent files. Render endpoint integrity as unverifiable until
  attestation exists.
- Assuming `main` breaks on repos whose default branch differs; resolve it.
- Name-match shadowing produces candidates, not findings — a local copy can be identical.
  Content diff before escalating.
- Payment and integration repos carrying local copies of safety rules are the ones to
  triage first.
- Rejecting an invalid analysis hides the fact that the analyzer ran; record and flag
  instead.

## Do not
- Do not let the analyzer bring its own rubric; the contract is owned here.
- Do not mark the coverage matrix fresh when the analyzed commit differs from the blessed
  one.
- Do not treat silence on a domain as a pass.
- Do not render workstation integrity green without attestation evidence.
- Do not tombstone adoption rows from a sweep that failed on any repo.
- Do not include secrets or credentials from harness files in the packet; the standards
  should contain none, and the packet builder should refuse if a scanner flags any.

## Related steering files
- analysis-source-control-azure-devops — repo estate, token, branch-policy posture
- analysis-shift-left-adoption — scanner PR-stage gates complement harness guardrails
- monitoring-azure-devops — audit stream for standards-repo changes
- foundation-ai-analyst-triage — persona runner pattern the external harness mirrors
- foundation-evidence-datasets-snapshots — manifest and analysis snapshots
- foundation-privacy-safety-secrets — secrets handling and injection-defense domains
