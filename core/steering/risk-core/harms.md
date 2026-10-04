<!-- scope: steering · risk-core · the roots of the tree. Top-level harms: executive-owned, tolerance-bearing, rarely changing. -->
# Top-level harms — the roots of the tree

Every risk-shaped thing in a program resolves, eventually, to one of a small fixed set of **top-level harms**. They are the roots. Conversations happen at any altitude; the record always backs out to the top.

## What a harm root is

A top-level harm is a consequence to the company serious enough that an executive owns it and leadership writes a tolerance against it. It is **not** a threat, a tool, a control, or a technical event. It is the thing the business would recognize as damage.

- **Executive-owned.** Each root names the seat that owns it.
- **Tolerance-bearing.** Each root carries one or two tolerance sentences — the only place in the program where leadership states what it will and will not carry.
- **Few and stable.** Five to seven. They change rarely; get them right once. The field guide's "five to seven tolerance sentences" are statements about these roots — tolerances were the top of the tree all along.

## The default set (replace with the company's own)

Until the company writes its own roots in the `risk-appetite` stage, `rbc init` lays down this starter set from the field guide. They are marked `[DRAFT]` and carry draft tolerances.

| Root | Harm | Typical owner |
| --- | --- | --- |
| **H1** | Business damage from a security incident | CEO / COO |
| **H2** | Regulatory and legal exposure | General Counsel |
| **H3** | Loss of customer trust and revenue | CRO / CEO |
| **H4** | Operational disruption | COO / CTO |
| **H5** | Financial loss and fraud | CFO |
| **H6** | Unlawful handling of personal data | DPO / General Counsel |

A company may split, merge, or rename these — a payments business may split H5 into fraud loss and dispute liability; a data business may elevate H6. What does not change is the shape: a handful of business consequences, each owned, each bounded by a tolerance.

## The rule

**Every node backs out to a root, or it is a finding about the tree.** A branch whose parent resolves to no root, a control that prevents no intermediate harm that rolls up, a tool that implements no control — each is an orphan, surfaced by the `orphan-node` sensor. The roots are what make "back out to the top" a finite walk.

## What this is not

Not a risk taxonomy to be exhaustive about — six business harms, not sixty categories. Not a severity scale — severity lives on the parent risk. Not a control framework's domains — those are the *middle* of the tree (`steering/domains/`), not the roots.

## Open items

1. **D11 (open):** the author's own canonical top-level harm set replaces this default. The engine and views are built to the shape, not the specific six.
2. Whether a company ever needs an eighth root, or whether more than seven is a sign two should merge (lean: seven is the ceiling; an eighth means the set is drifting toward a taxonomy).
