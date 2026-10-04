<!-- scope: steering · risk-core · illustration. Precedents and constructed scenarios, never blurred. -->
# Illustration — show the branch before asking for the decision

A branch that no one has *felt* will not be decided. Satoru attaches an illustration to every branch it proposes, of exactly two kinds, never blurred.

## Precedent — a real incident, cited

A real event that is this branch happening to a company like this one: a breach disclosure, a DOJ or regulator release, a CISA advisory, a vendor post-mortem, industry reporting.

- **No URL = no claim.** Source, date, and the victim's sector are recorded. Satoru quotes a line and links; it never embellishes beyond the source.
- A precedent in the **same industry** moves the branch's likelihood to `precedent` or `probable` — the field guide's evidence-based rating, now with the evidence attached.
- Bounded search budget per branch. "Not found in public sources as of `<date>`" is a valid, recorded result — not an excuse to invent one.
- Freshness is checked on re-use (facts decay); a precedent cited a year ago is re-validated before it is leaned on again.

## Constructed scenario — a story told here, labeled

A one-paragraph story of the branch happening *at this company*, in its own terms — its systems, vendors, roles, and data from inventory — ending at the top-level harm and the decision it illustrates.

- **Labeled "Illustrative — not a real event"** on every surface, including compiled views and anything published.
- Grounded strictly in inventory: **never assume tools they don't have.** If inventory shows no VDI, the scenario does not feature one.
- Vivid and sober, never fear-framed. No real victim named unless cited as a precedent. One paragraph.
- It exists to make the decision legible, not to sell the control.

## Why both, and why never blurred

A precedent proves the branch is real in the world; a constructed scenario proves it is real *here*. Blur them — dress a made-up story as a real event, or cite a precedent that is actually a hypothetical — and you have manufactured fear, which is the thing the author's whole compliance stance rejects (the "Instagram of your life" is a lie of curation; a fabricated precedent is a lie of fact). The label is the integrity line.

## Records and review

Both land in `scenarios/` with `kind`, `branch`, `source_url` (required for precedents), `industry`, `date`, `told_in_our_terms`, and the label. They feed the scenario table and the Intake Reflex. The `risk-assessor` owns them; the `business-owner` reviewer may object to a constructed scenario as implausible for *this* company — which is itself information about the branch. NIST SP 1353's caution holds: fictional material is for illustration only and is never used as a template for a real record.

## What this is not

Not "make them up" without a label — the author's instinct to construct a scenario is right, and the label is what keeps it honest. Not a threat-intelligence feed. Not a substitute for the breakdown — the illustration motivates the decision; the breakdown makes it.
