<!-- scope: scope · breakdown — the single-input path, end to end, with the Intake Reflex. -->
# Scope: breakdown

The default scope. Takes one input — a concern, a finding, a proposed tool or monitor, "for compliance," a leadership question — and runs it to a decided, owned, recorded risk. Depth within a domain is the maturity dial, not the scope.

## Stage path

```
state-init → (intent-capture) → breakdown → decide
```

`intent-capture` and the harms/tolerances from `risk-appetite` are assumed present (a program that has run `rbc init` has the default roots). A single breakdown does not re-run appetite; it compares to the tolerances already there, or flags the one it needs.

## How Satoru runs it

1. **Orient and place.** Resolve any named tool/vendor/control through the program (`rbc trace`). Show the chain to the top-level harm first.
2. **Classify.** If the input is a *response* (monitor, tool, "for compliance," scanner row), fire the **Intake Reflex** (`core/steering/risk-core/intake-reflex.md`): fire back once, infer the worry, propose placed candidate branches, illustrate, place the proposal, surface the governance gap. If the input is already a risk or finding, go straight to the breakdown steps.
3. **Break it down.** Follow `core/stages/2-identify/breakdown.md` steps 1–12. Author `risk-parent`, `risk-branch`, `scenario`, and (if a monitor/tool was proposed) `monitoring-proposal` records.
4. **Review.** `business-owner` produces the `review-record`. Bare "no concerns" is rejected. Circuit breaker bounds the loop.
5. **Decide.** `core/stages/2-identify/decide.md`: one disposition per branch, owned, with premises and review trigger. A human authorizes.
6. **Check.** Run `rbc sensors` and `rbc validate` on the program. Resolve reds before calling it done. Report the tree (`rbc tree <harm>`) so the person sees what moved.

## Output to the person

- The parent sentence and the branch set, each with its proposed/decided disposition and owner.
- The illustrations that make each branch legible.
- Where any proposed monitor/tool sits, and **what it cannot see**.
- The governance gap, if any — the missing tolerance and the executive it goes to.
- Three moves with owners. End on the asks.

## Done means

Every branch backs out to a root; every parent names (or flags) a tolerance; every decision is owned, has premises, and — where recorded — is authorized by a human; sensors show no reds; nothing agent-authored was recorded ungated.
