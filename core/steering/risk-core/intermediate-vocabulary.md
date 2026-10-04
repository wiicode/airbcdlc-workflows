<!-- scope: steering · risk-core · the controlled vocabulary between parent risks and roots. Never free text. -->
# Intermediate harms — the controlled vocabulary

Between a parent risk and a top-level harm sits one **intermediate harm**: a controlled-vocabulary term that lets the engine resolve any chain to a root, and lets a control declare what it `prevents[]`. It is never free text — free text here breaks the tree's ability to resolve and roll up.

## The terms

| Term | What it names |
| --- | --- |
| `data-leaves-control` | Company or customer data goes somewhere the company can no longer govern it. |
| `credentials-secrets-compromised` | Credentials, tokens, or secrets are stolen, leaked, or usable by the wrong party. |
| `identity-acts-after-trust-ended` | An identity keeps acting after the trust behind it ended (a leaver, a revoked vendor, an orphaned token). |
| `unauthorized-undetected-change` | A change is made that was not authorized, or not seen. |
| `service-unavailable-degraded` | A system or dependency the company relies on is down or degraded. |
| `data-lost-corrupted` | Data is destroyed or corrupted beyond recovery. |
| `financial-flows-manipulated` | A payment, billing, or financial flow is diverted or defrauded. |
| `third-party-compromise-reaches-us` | A third party's compromise reaches the company through the access or data it holds. |
| `personal-data-processed-unlawfully` | Personal data is processed without a lawful basis, beyond its limits, or against a right. |

## How it is used

- A **control** declares `prevents: [<term>, …]` — the harms its capability exists to reduce. The Control Compiler produces controls already wired to the tree through this field. A control with an empty `prevents` is a finding about the catalogue.
- A **parent risk** declares `intermediate_harm: <term>` and `top_harm: <H-id>`. The term is the hinge: the engine knows which root a parent rolls into because the term maps upward.
- The engine resolves `tool → control (prevents term) → parent (intermediate_harm term → top_harm) → root`.

## Extensibility

The set is framework-supplied and **extensible per profile**, never ad hoc. A framework profile may add a term (a payments-heavy profile might split `financial-flows-manipulated` into fraud-loss and dispute-liability); it does so by declaring the term in the profile, so the schema enum and the roll-up both know it. A program never invents a term in a single record.

## What this is not

Not a threat taxonomy (STRIDE, kill-chain) — those describe *how*; this describes *what harm*. Not the top-level harms — those are the roots (`harms.md`); these are the layer beneath. Not a control category — a capability (`steering/domains/`) is the control-side grouping; the intermediate harm is the harm-side term a capability maps to.
