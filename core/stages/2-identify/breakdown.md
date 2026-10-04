---
id: breakdown
phase: 2-identify
requires: [risk-appetite]
mode: subagent
personas: [risk-assessor, business-owner, accountable-seat]
produces: [risk-parent, risk-branch, scenario, monitoring-proposal, review-record, decision]
---

<!-- scope: stage · the only analysis the program needs. Every input goes through this. -->
# Stage: breakdown

Every item — a one-line concern, a finding, a vendor advisory, a proposed tool, a leadership question — goes through this one method. About twenty minutes once practiced. No scoring matrix, no heat map.

## Steps

1. **Classify the input.** What is it, once the tool and the verb are stripped? Harm · mechanism · branch · finding · control gap · governance gap · proposed response. If it is a response, the **Intake Reflex** fires (`core/steering/risk-core/intake-reflex.md`).
2. **Place it in the cycle.** Which CSF Function did it enter at (usually Detect/Respond), and which should it have started at (usually Govern/Identify)? Saying so once is often the whole correction.
3. **Name the parent risk.** One sentence: `[who] suffers [what] because [mechanism]`. Consequence to the company. Severity on four words. Write it to a `risk-parent` record.
4. **Name the mechanism.** The standing condition every branch hangs from.
5. **Enumerate branches.** Each distinct path from mechanism to harm. Rate likelihood from evidence (precedent / probable / plausible / remote). Expect one branch to be the governance gap. Write each to a `risk-branch` record.
6. **Illustrate each branch.** A cited precedent or a labeled constructed scenario (`illustration.md`). Write to `scenario` records.
7. **Choose one response per branch.** Avoid · mitigate · accept · transfer. Never a slash; a fallback goes in the decision record. (Proposed by the risk-assessor; decided by the business-owner.)
8. **Join each branch to the catalogue.** Which control owns it, at what state. No control on a branch = a finding about the catalogue.
9. **Map each response to the framework.** The CSF subcategory it lands in. The recorded decision itself is ID.RA-06.
10. **Check against tolerance.** Which tolerance the parent compares to. If none, draft it and flag the missing governance input.
11. **Place any proposal.** A tool, a monitor, a data pull goes on the tree — which branch, which half, which Function — via a `monitoring-proposal` record. The placement is the argument.
12. **Write the guidance.** Three moves at most, each with an owner. Where the conversation goes next, not a project plan.

## Steering

- `core/steering/risk-core/placement-rules.md` — the six rules.
- `core/steering/risk-core/intake-reflex.md` — when the input is a response.
- `core/steering/risk-core/illustration.md` — precedent vs constructed.
- `core/steering/risk-core/premises.md` — a decision records what it rests on.
- `core/steering/method/field-guide.md` §6 — the method and its two worked examples.
- `core/steering/house-rules/voice.md` — engage, never scold, lead back.

## Risk Check

Which top-level harm and tolerance does this output serve? Every branch must back out to a root (`orphan-node`), and the parent must name a tolerance or flag its absence (`tolerance-referenced`). `premise-moved` runs at this gate and every later one.

## Gates

- **Review gate (required):** `business-owner` produces a `review-record` before any `decision` is recorded. A bare "no concerns" is rejected. Circuit breaker wraps the loop: three cycles or two hours, then escalate / narrow / accept-with-dissent / stop.
- **Decision gate:** a disposition is set by the business owner; `authorized` is set only by a human; an Accept carries a review trigger; a one-way door carries explicit human authorization.

## Sensors

`harm-sentence` · `single-response` · `control-link` · `owner-outside-security` · `tolerance-referenced` · `orphan-node` · `finding-not-risk` · `monitor-complete` · `decision-complete` · `premise-moved` · `residual-from-control-health`.
