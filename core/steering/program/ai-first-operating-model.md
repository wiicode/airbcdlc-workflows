<!-- scope: steering · program · the AI-first operating model: thesis, the crawl/walk/run loop, policy vs operating layer, intake in days, reachability, measures. -->
# The AI-first operating model — security built for agents, not for headcount

**Status:** framework steering, working position 2026-10-05; from the author's blueprint for security in an AI-first company. Companions: `../house-rules/voice.md` ("Speaking to leadership"), `../house-rules/agent-trust-boundary.md`, `../domains/ai-agents.md`, `../compliance/compliance-automation.md` (evidence collected by adapters), `../risk-core/placement-rules.md` (decisions attach where the owner can decide).

## The thesis

Security is redesigned for an AI-first company, not scaled up for it. It describes systems and outcomes, never people. It is not a request for budget, a warning about risk, a defense of the current program, or a position on any policy.

| Form | The sentence |
| --- | --- |
| Short | Security moves at the speed of the AI roadmap. |
| Business | Every AI use case shipped faster than a competitor is a security decision made well. |
| Engineering | Security that developers never have to think about, because the safe path is the easy path. |
| Board | Smaller teams, more autonomy, same or better control posture, and a diligence-ready story to prove it. |

**Why now** — three facts, stated or labeled `planning assumption` per program: the company has declared an AI-first direction; agents are moving from human-in-the-loop to autonomous; teams are smaller while the diligence and audit timeline is fixed. A program sized for headcount and gated at the end of projects is outrun within a few quarters.

## The loop: crawl, walk, run — and what each lap leaves behind

A cycle, not a ladder. Each lap produces the artifact the next starts from; the second lap is faster because the ownership model, the fabric and the control engine already exist.

| Lap | What gets built | Artifact | In the harness |
| --- | --- | --- | --- |
| **Crawl** — the team that can do it | The function as a system: every control has one owner and one independent second reviewer, so nothing is self-attested; staffed roles have written charters; future roles are gated on a trigger, not a budget cycle; every eliminated role has its substitute on record (a platform, a managed service, an automation, an AI-leveraged growth path for an existing engineer); the six AI capabilities enter the control table | A state-of-the-department document and an ownership model | `roles.md` — declared capacity with one owner and one independent reviewer per control; `founder` (≤50) and `growth` (50–150) scopes; the six capabilities in `../domains/ai-agents.md` compiled as parked or planned |
| **Walk** — the fabric | Agentic tooling standing where a headcount line would have been; AI-assisted skills under detection; an automated vulnerability pipeline; the AI controls live | A tooling inventory and a control-coverage view | Adapters and sensors: each adapter descriptor names the role it replaces and its boundary (`agent-trust-boundary.md`); `implements[]` wires tools to controls; `coverage/<domain>.yaml` shows what is active, planned, parked, blocked |
| **Run** — operate on the model | Ownership in force; controls producing evidence on cycle; AI controls moved from parked to active; parked lanes kept visible as headcount gaps, never absorbed into one person's load | Evidence on demand | Evidence tasks on cadence; the one metric — share of risks with a recorded decision and a named owner — computed per root; `coverage: parked` surfaced as a needs-action row with the gap named |

The next Crawl is higher autonomy and fewer people; the program is redesigned again for that.

## Policy versus the operating layer — the shape rule for `policies/`

Policy belongs to whoever owns the policy seat. The architecture function builds the layer underneath: the mechanisms that make any policy real and keep working when the policy changes. Mechanisms outlive documents.

| Policy holds | The operating layer holds |
| --- | --- |
| only what does not change: tiers, the non-negotiables, the reporting line; short | everything else: procedures that live where decisions are made and change without a policy cycle |
| what the auditor reads | what an engineer reads on Monday |

**The test for every line:** would an engineer read it and know what to do, and would a product leader read it and see speed? **If it reads as permissions, it is a policy** and belongs to the policy owner. Policy gets lighter by subtraction, not by argument.

At M3 the `policy-set` and `policy-drafting` stages apply this as the shape rule: a policy record carries tiers, non-negotiables and the reporting line; every procedure sentence is moved to the control, the task, the inventory page or the checklist it belongs to, with a pointer back. The `no-over-commitment` sensor reads the result.

What the operating layer contains, so it is never mistaken for a policy: one page; a tier table for agents and tools; eight to ten non-negotiables each enforced in tooling; an intake that answers in days; a reporting line that surfaces unknowns; every planning assumption sourced or labeled; substance where the work happens and pointers everywhere else; one worked example on a real use case that ends in go — scoped identity, data boundary, audit trail, kill switch, the benefit stated next to the residual.

## Intake that answers in days

Benefit is weighed against reachable risk, and **"go, with these defaults"** is the usual verdict. In the harness this is the `obligation` scope's Why gate and the `intake-triage` stage: an AI use case enters as an intake item; the Intake Reflex places it on the tree; the ten questions (`../domains/ai-agents.md`) find the gaps; the verdict names the defaults (scoped identity, data boundary, audit trail, kill switch) and the residual with its owner. No committee; no executive on a daily path; no approval more often than weekly.

## Reachability decides, in both directions

Risk is judged by reachability and blast radius, not by severity scores and checklists. The same rule that lets a use case go fast refuses to spend effort on what cannot be reached. In the harness this is addendum A's finding logic: `finding.kind ∈ {vulnerability, …}`, `exploitable ∈ {true, false, undetermined}`, and an SLA is permitted **only when `kind: vulnerability ∧ exploitable: true`**. Scanner imports land `undetermined` and earn an SLA by evidence; a reachable finding is treated as real work; an unreachable one is recorded and left alone. Applied to agents: effective access is the reachability of the agent; a connection whose `enforcement_point` is `none` makes every target reachable.

## Before and after

| Dimension | Conventional program | AI-first program |
| --- | --- | --- |
| How risk is judged | Severity scores and compliance checklists | Reachability and blast radius; risk decides |
| Where security sits | A gate at the end of a project | A default inside the tooling developers already use |
| Who does the work | Analysts closing tickets | Agents collecting evidence and enforcing policy; humans on judgment calls |
| What leadership sees | Finding counts and audit status | Time-to-safe-ship and control coverage |
| Diligence posture | A scramble when the data room opens | Answerable in 48 hours, any day |

## Measures — candidate `rbc/views/`

Baselines in the first 30 days; targets proposed, never promised, until a baseline exists. Each measure is a compiled view with its source record named; the engine computes it (the calculator rule).

| Outcome | Measure | Source records | Why leadership cares |
| --- | --- | --- | --- |
| AI ships faster, safely | Days from AI use-case proposal to approved in production | intake item `created` → decision `approved_by` date | Speed is the whole thesis |
| Agents are governed | % of agents with scoped identity, logging and a kill switch | `agents` silo: connections with `declared_access`, `enforcement_point ≠ none`, `kill_switch_tested` | Autonomy with control |
| Security is not the drag | Security review as % of AI project cycle time | review records' open → closed against the intake item's span | Engineering velocity |
| Risk work is real work | % of remediation effort on reachable vulnerabilities | findings with `exploitable: true` vs all findings with effort logged | Efficiency over headcount |
| Compliance runs itself | % of controls with automated evidence collection | control implementations with an adapter-produced evidence task | Audit cost; diligence |
| Diligence-ready | % of a standard questionnaire answerable within 48 h | questionnaire fact store coverage | Deal readiness |
| Posture holds as teams shrink | Device trust at 100%; headcount flat or down with coverage up | `devices` compliance; `roles.md` capacity against `coverage` | Proof the model works |

Present one or two to any audience, matched to their question (`voice.md`, "Speaking to leadership"). Never all of them.

## Scope split: architecture and operations — a `roles.md` pattern

The function is defined by impact first, responsibilities second, title last.

| Architecture owns | Operations owns |
| --- | --- |
| identity for agents, least-privilege scopes, data boundaries, audit trails, kill switches, model and vendor risk | alert triage, ticket queues, vendor renewals, routine access reviews |
| the intake that answers in days; the reachability model | runbooks, and being the escalation path for anything a runbook should handle |
| the scaffolding from human-in-the-loop to autonomous, written and enforced | people management of the operations team |
| compliance automation and diligence readiness: evidence collected by agents | — |
| security's voice on the AI roadmap; the function's own AI tooling | — |
| — | authoring or defending policy (the policy seat) |

When the split happens, it happens visibly: operations consolidates under one named owner with a written RACI for every recurring responsibility; architecture keeps authority over security tooling and a seat in incident response on AI-related incidents; a 30-day handoff with a weekly check closes it. `roles.md` records both seats, the RACI, and the handoff date; a recurring responsibility with no seat is a needs-action row.

## Operating principles

- **Direction first.** The company's direction before the function's role, every time.
- **Systems, not people.** What the organization can do, never what individuals cannot; a problem is an architecture gap with a fix attached.
- **Make leadership's AI story true.** Their metrics are the function's deliverables.
- **Visible handoffs.** Anything stopped has a named owner, in writing, before it stops.
- **Show, don't present.** With engineering and product the artifact is working tooling; slides are for the board.
- **Efficiency over headcount.** Every proposal reduces human toil or it is not ready; the function models this first.
- **One ask at a time.** Never two decisions in front of a leader in one conversation.
- **Calm is the signal.** In a reorg, steady and specific wins.

## What this is not

Not a request for budget or a headcount plan — it is a claim about where the company is going and what security becomes to match. Not a policy — nothing here reads as permissions; if a line does, it moves to the policy owner. Not a promise of targets — baselines first. Not a replacement for the risk tree — every measure above reads from records that already back out to a root.

## Open items

1. Which of the seven measures ship as core `rbc/views/` at M2 and which wait for the silos they read (agents at M1, questionnaire facts conditional). *Lean:* the one metric plus "agents are governed" first.
2. Whether `roles.md` carries the architecture/operations split as two seats or as a RACI table per recurring responsibility. *Lean:* both — seats for ownership, RACI for the handoff.
3. The tier table for agents and tools: whether it is the autonomy ladder in `../domains/ai-agents.md` verbatim or a program-specific overlay. *Lean:* the ladder is the framework default; a program renames tiers in `rules/agents.yaml`.
