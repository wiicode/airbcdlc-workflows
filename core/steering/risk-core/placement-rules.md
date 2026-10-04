<!-- scope: steering · risk-core · the six rules that make the tree resolve. Loaded ambiently into every stage. -->
# Placement rules — the six that make the tree hold

Every risk-shaped thing is a node on one tree with a small fixed root (`harms.md`). Conversations happen at any altitude; the record always resolves to the top. Six rules keep that true.

```
tool            a system in inventory; implements[] controls; evidence/findings hang here
control         library + implementation; prevents[] intermediate harms via its capability
capability      a coverage expectation in a domain
branch          one way the mechanism produces the harm   ← ONE disposition; owner outside security
parent risk     [who] suffers [what] because [mechanism]  (mechanism → intermediate harm)
intermediate    controlled vocabulary (see intermediate-vocabulary.md)
top-level harm  a root; executive owner; tolerance(s)
```

## 1. Every node backs out to a root, or it is a finding about the tree.

Generalizes "a control with no risk is a finding" to tools, vendors with privileged access, monitors, tasks, findings, and intake items. A tool that implements no control, a control that prevents no intermediate harm, a branch whose parent resolves to no root — each is an orphan. Sensor: `orphan-node`. Domain doctrine supplies the upward edge (the harms a domain exists to prevent), so a compiled control is born wired into the tree.

## 2. Placement is the first line of every answer.

Mention a tool and the assessor resolves it through inventory and prints the chain before anything else. The placement is usually the whole argument; editorial is rarely needed. `rbc trace <node>` prints up; `rbc tree <harm>` prints down.

## 3. Decisions attach where the owner can decide.

- **Tolerances** at the root — executives.
- **Dispositions** at the branch — the business owner outside security whose objective is harmed.
- **Implementation** at the control — security.
- **Evidence** at the tool — engineering.

Little conversations happen at the bottom and cannot quietly alter the top. "Switch tool X for tool Y" is a control-implementation question on a branch whose disposition is already decided — it does not re-open the disposition unless a premise moved.

## 4. Decisions carry premises; premises move.

A decision records the inventory facts, control states, and tolerance it rests on. Sensors in every later stage compare and **re-open** the decision, with the reason, when one moves (`premise-moved`). This is how "risk evaluation is present in every stage" is actually implemented. See `premises.md`.

## 5. Residual rolls up.

Branch residual is read from control health — a mitigated risk resting on failing controls is quietly back toward inherent (`residual-from-control-health`). Parent residual is the aggregate of its branches. Root exposure is the roll-up compared to its tolerance. The executive view is five to seven rows. See `roll-up.md`.

## 6. Same tree, five zoom levels.

By harm (executive), by risk (forum), by branch (assessor), by control (operations), by tool (engineering). The one metric — share of risks with a recorded decision and a named owner — is computed per root.

## What this is not

Not a scoring model — there is no arithmetic here beyond the roll-up, and the roll-up states its rule. Not a taxonomy — the tree is a resolution path, not a classification scheme. Not a dependency graph of systems — the edges are risk edges (prevents, treats, backs-out-to), not network reachability.
