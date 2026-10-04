---
id: decide
phase: 2-identify
requires: [breakdown]
mode: mob
personas: [business-owner, accountable-seat, risk-assessor]
produces: [decision]
---

<!-- scope: stage · the governed step. One disposition per branch, owned and recorded. -->
# Stage: decide

Set and record one disposition per branch. Three of the four responses close here, with owner and date; Mitigate proceeds to Treatment.

## Steps
1. For each branch, the business owner chooses avoid / mitigate / accept / transfer.
2. Record the decision with premises, residual, review trigger, and ADR fields.
3. A human authorizes; the accountable seat confirms completeness and the tolerance reference.

## Gates
Review record present; `authorized` by a human; Accept carries a review trigger; one-way door carries explicit authorization.

## Sensors
`decision-complete` · `single-response` · `owner-outside-security` · `premise-moved`.
