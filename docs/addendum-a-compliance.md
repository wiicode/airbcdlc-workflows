# AI-RBCDLC — Addendum A: Compliance is an input, never an origin

**Status:** working position 2026-10-02, drafted from the author's grounding rules; to be folded into plan v0.3. Companion: `AI-RBCDLC-PLAN-v0.2.md` §4 (steering), §6 (controls), §7 (risk), §8 (stages).

## The problem, in the author's words

> "Many security programs start with a compliance catalog and erroneously work backwards. 'We need a pentest for compliance.' 'Show me evidence of infrastructure scans.' Something about PCI. These surface first, with no connection to business need, architecture, or what customers want, and they become a drag on security operations. Compliance automation makes it worse — compliance in a box. 'We are secure because we bought Vanta.' 'Vanta told us to.' The platform gets declared authoritative."

The harness has to claw that position away. Not by refusing compliance — attestations are real business obligations — but by making every compliance demand answer *why*, *for whom*, *at what cost*, and *which harm or obligation it serves* before it can become a control, a task, or an SLA.

## The grounding rules (the author's five, with what each implies for the harness)

**1. SOC 2 Type 2 is an attestation.** It proves your controls operate, over a period. They are *your* controls; you decide what works. An auditor's say is limited to whether the attestation will survive their own firm's peer review.
→ The program's catalogue is authored by the program, in the Shape, justified by harms and obligations. SOC 2's Trust Services Criteria are a **crosswalk target** and an **obligation source** — never a catalogue. An auditor request enters as an obligation with `source: auditor`; the response distinguishes "this makes the attestation defensible" (satisfy) from "this redesigns our control" (push back, record why).

**2. PCI applies to cardholder data.** No CHD → think about security-impacting adjacency, and stay pragmatic.
→ PCI scope is *derived from inventory*: data stores and systems that hold, process or transmit CHD. If the inventory shows none, PCI is an obligation only where a contract or acquirer says so, and the response is scoped to what actually touches card flows (often: an SAQ type, not a program). A sensor compares PCI obligations to CHD presence in both directions.

**3. ISO 27001 is procedural.** Everything gets documented and practiced.
→ ISO is a *capacity decision*: Annex A is coverage, not catalogue; the ISMS clauses (4–10) are a documentation and rehearsal load the business must be able to carry. The harness prices that load against declared capacity before the obligation is accepted.

**4. Policies must be human-readable and never over-commit obligations.**
→ Already doctrine (plan §9: the three-axis rubric; the +1 over-commitment counter per named tool, exact timeframe, locked algorithm, named individual, unvalidated threshold). Extended here: a policy sentence written *to satisfy a criterion* rather than to tell a person what to do is an over-commitment by construction and is flagged.

**5. A vulnerability is an exploitable weakness.** If it is not exploitable, the Swiss Cheese Model is acknowledged and it is a **finding**. Findings feed a signal-based triage that informs tech debt, hygiene, product design, secrets management, misconfiguration — and vulnerabilities. Only vulnerabilities carry SLAs. Most scanners label findings as vulnerabilities; knowing that is the whole skill of triage.
→ A finding taxonomy with `exploitable` as a *determined* field (with basis), SLA permitted only when `kind: vulnerability`, and a scanner-import rule that lands everything as `finding` until exploitability is established.

---

## New record: the Obligation

Compliance demands get their own object, distinct from risks and from controls. An obligation is something the business has promised, been required, or chosen to seek — from a customer contract, a regulator, an insurer, an acquirer, an attestation the company wants, or a questionnaire a prospect sent.

| Field | Rule |
| --- | --- |
| `id`, `title` | |
| `source` | `customer-contract` · `prospect-questionnaire` · `regulation` · `insurer` · `acquirer/processor` · `attestation-sought` · `auditor` · `compliance-platform` · `internal` |
| `asked_by` | named counterparty (customer, regulator, insurer, auditor, platform) |
| `requirement` | the exact text, quoted and dated — never paraphrased |
| `why_they_want_it` | the counterparty's actual need (an attestation letter? a yes on a questionnaire? a report? a control?) — often smaller than the literal ask |
| `harm_served` | the program risk(s) this obligation would also treat, or `none` (then it is a pure business obligation) |
| `capacity_cost` | hours, money, people, recurring or one-time — against the capacity declared in `steering/roles.md` |
| `architecture_fit` | what the inventory says: CHD present? externally exposed surface? infrastructure to scan? |
| `disposition` | **satisfy** · **satisfy-minimally** (scoped to what the counterparty needs) · **negotiate** (alternative evidence) · **decline** · **transfer** (buy it: insurance, outsourced attestation, platform) · **defer** (with review date) |
| `owner` | the business owner who carries the consequence of the disposition (sales, finance, product) — outside security |
| `controls[]` | the program controls that satisfy it, *after* they exist for their own reasons |
| `decided_at`, `review_at` | |

Direction rule: the crosswalk runs **from controls to obligations and criteria**, never the reverse. An unsatisfied criterion is a *finding about the catalogue* (allowed, visible); a control whose only justification is a criterion is a **compliance-origin control** and is flagged until it names a harm or an obligation with a disposition.

The obligation register also gives Transfer decisions (plan §7) their instruments a home: insurance terms, contract clauses, platform contracts.

---

## The Why gate (hard questions, applied at the door)

Any intake item classified as compliance-origin — the request names a framework, a platform, an auditor, a questionnaire, or uses "for compliance" as its reason — passes the Why gate before the ordinary breakdown. The gate is a stage step with its own template; the Business Owner reviewer plays the counterparty's actual interest, and the Risk Assessor names the anti-pattern once.

1. **Who is asking, and what do they actually need?** Quote the requirement. Separate the literal ask from the need behind it. ("Show me infrastructure scans" is usually "show me you would notice an exposed service.")
2. **Which harm does this serve?** Write the harm sentence if one exists. If none does, this is an obligation, not a risk — route it to the obligation register and stop treating it as security work.
3. **What does the architecture say?** Pull the inventory: is there CHD? an external surface? an infrastructure to scan? a vendor with privileged access? If the thing being asked about does not exist, the honest answer is "not applicable, and here is the inventory that shows it."
4. **What does it cost, and do we have it?** Hours, money, people, recurring or not — compared to the declared capacity. Over budget → negotiate, defer, decline or transfer; never silently absorb.
5. **What is the cheapest sufficient response?** The one that satisfies the counterparty's *need* at the smallest standing cost. Scoped beats blanket; evidence you already produce beats new ritual; a documented Accept beats a control nobody will run.
6. **Who decides, and what did they decide?** Business owner outside security; disposition recorded; review date set.

Guidance output: three moves at most, each with an owner — the breakdown's rule.

### Worked example — "We need a pentest for SOC 2"

| Step | Answer |
| --- | --- |
| Who / need | Prospect's procurement team; the questionnaire asks "date of last third-party penetration test." Need: a dated report they can file. The SOC 2 auditor has not asked; CC4/CC7 criteria do not mandate a pentest. |
| Harm served | Customers suffer data exposure because the externally reachable API accepts unauthenticated requests on two legacy routes (inventory: `systems/api-gateway.yaml` lists 2 public routes without auth, flagged `legacy`). A real harm exists — but it is about *those two routes*, not about "a pentest." |
| Architecture | One externally exposed surface (the API and the web app); no CHD (payments via a hosted processor — `vendors/stripe.yaml`); infrastructure is a managed cloud account with no self-run network. A "full infrastructure pentest" tests things that do not exist. |
| Cost / capacity | Full-scope annual test: ~$25–40k and ~40 engineering hours of remediation theater. Scoped external test of the API and web app: ~$8–12k and the remediation work already on the backlog. Declared security capacity: 3 h/week. |
| Cheapest sufficient | Scoped external test of the exposed surface, dated report; fix the two routes first so the report is clean; answer the questionnaire with the report date and the scope statement. Monitoring proposed by the vendor ("continuous attack surface scanning") is placed on the branch as Detect, post-compromise half — it is not the response. |
| Decision | Obligation `O-014` → **satisfy-minimally**; owner: VP Sales (the deal is theirs); the two legacy routes become branch (b) of risk `R-021` → **mitigate** (remove routes), control-owned by Identity & Access; review in 12 months or on next prospect ask. |

One compliance ask became one obligation with a disposition, one real risk with a mitigation, and a monitoring proposal placed where it belongs — and the business owner chose the scope.

---

## Compliance automation platforms — their place

Doctrine the platform study already found in the author's practice: *"We decide what the checks are about; the platform clicks."* Expanded for the harness:

- **What a CA platform is good for:** collecting evidence on cadence; presenting it to an auditor; flagging drift in things it can see (a disabled MFA policy, a missing disk encryption flag). Its monitors are **findings** — inputs to control testing — never risks and never controls.
- **What it is not:** an authority on control design; the risk register ("treatment decisions stay in the platform" is the failure mode); the catalogue (its control library is a *control source* under plan §6.5 — a seed to be re-shaped and justified, not the program); a security posture ("secure because we bought it" is the anti-pattern by name).
- **Buying one is itself a decision.** Deep integration into every cloud account, IdP and HR system gives one vendor visibility into everything the company runs. The harness records the purchase as a **Transfer-of-exposure** decision with a vendor-management owner and a review date, exactly as the field guide §12 says.
- **The adapter contract makes this structural.** CA platforms connect as *sources* (findings, evidence filings, policy drift) and as *sinks* (the program pushes its controls and evidence to the auditor surface). They never write to `controls/library/`, `risks/`, `decisions/` or `tolerances/`. The direction is enforced by the adapter descriptor, not by a prompt.

---

## Findings vs vulnerabilities — the signal-based triage

| Field on `finding` | Rule |
| --- | --- |
| `kind` | `vulnerability` · `misconfiguration` · `secrets` · `hygiene` · `tech-debt` · `product-design` · `coverage-gap` |
| `exploitable` | `true` · `false` · `undetermined` — scanner imports land as `undetermined` |
| `exploit_basis` | required when `true`: reachability (exposed? authenticated?), privilege required, known exploit / weaponization, data behind it. "The scanner says critical" is not a basis. |
| `sla` | **permitted only when `kind: vulnerability` and `exploitable: true`**; otherwise the field is absent and the item carries an owner, a backlog and a cadence instead |
| `control_tested` | the control this finding is evidence about — required (findings are never register rows) |
| `signal_route` | where it informs: tech-debt backlog · hygiene cadence · product design review · secrets program · configuration baseline · vulnerability SLA queue |
| `layers` | Swiss Cheese: the other controls that stand between this weakness and a harm — what makes a non-exploitable weakness acceptable to carry |

Triage doctrine: a weakness with no reachable path is a hole in one slice; it is acknowledged, routed and tracked — not SLA-bound, not escalated as a vulnerability. The triage persona's first act on any scanner export is to *downgrade the vocabulary*: everything is a finding until shown exploitable. The field guide's rule holds: a finding is evidence a control is not holding; the risk is the harm the control exists to prevent, and that harm is already in the register or it is a finding about the catalogue.

---

## New anti-patterns (extend the field guide's eight)

| Pattern | Signature | Why it is wrong |
| --- | --- | --- |
| **Compliance as origin** | "We need X for compliance / for SOC 2 / for the audit" | Names the attestation instead of the harm or the obligation; skips who is asking and what they need |
| **Platform as authority** | "The platform told us to"; "we're secure because we bought it"; "it's red in the dashboard" | A vendor's monitor is a finding about one control; posture is a decision record, not a purchase |
| **Framework as catalogue** | Adopting the TSC, Annex A or a platform's control library wholesale as the program | Criteria are crosswalk targets; controls are authored and justified; a criterion without a control is a visible finding, not a mandate |
| **Scope by default** | PCI (or HIPAA, or ISO) applied without inventory showing the data or surface that triggers it | Scope is derived from inventory; "no CHD" is a legitimate, evidenced answer |
| **Scanner output as vulnerability** | Every scanner row treated as a vuln with an SLA | Only exploitable weaknesses are vulnerabilities; the rest are findings routed by signal |
| **Pentest as ritual** | An annual test with no stated surface, harm, or counterparty need | A test is evidence about a named surface for a named reader; otherwise it is spend without a decision |
| **Documentation as security** (ISO) | Procedures written to exist, never practiced | ISO is procedural *and practiced*; unrehearsed procedures are over-commitments |

New intake refusals, applied with the original six: a compliance-origin item with no quoted requirement and named counterparty is returned; a finding with an SLA but `exploitable ≠ true` is returned; a control whose only justification is a criterion or a platform check is held until it names a harm or an obligation.

---

## Changes to fold into plan v0.3

**Steering (new set `steering/compliance/`):** `attestation-vs-control.md` (rule 1), `pci-scope.md` (rule 2), `iso-is-procedural.md` (rule 3), `compliance-automation.md`, `findings-vs-vulnerabilities.md` (rule 5), `the-why-gate.md`, `anti-patterns-compliance.md`. Rule 4 extends `steering/shape/policy.md`.

**Records and schemas:** `obligations/*.md` (new); `findings/*.yaml` gains `kind`, `exploitable`, `exploit_basis`, `sla` (conditional), `signal_route`, `layers`.

**Stages:**
- GOVERN **1.5 obligations-intake** — what the business has promised or seeks, from whom, quoted; capacity priced; dispositions by the business owner. Produces `obligations/` and feeds 1.2 (tolerances often fall out of obligations) and 4.5 (crosswalk targets).
- IDENTIFY 2.4 breakdown and OPERATE 5.1 intake-triage gain the **Why gate** step for compliance-origin items.
- CONTROL 4.5 framework-crosswalk gains the **direction rule** and emits "compliance-origin control" findings.
- ASSURE 6.2 control-testing gains **finding triage** (taxonomy, exploitability determination, signal routing); 6.4 audit-package is explicitly a *view* of the program for an attestation, with the obligations it satisfies.
- Scopes: `obligation` (1.5 → 2.4 Why gate → 2.5 decide) for a single compliance ask; `audit-prep` now begins with 1.5.

**Sensors:** `obligation-quoted` (requirement text + counterparty present); `control-justified` (harm or obligation on every control; platform-only → flag); `crosswalk-direction`; `pci-scope-vs-chd` (PCI obligations ⇄ CHD in data stores/systems, both directions); `sla-only-exploitable`; `exploitable-has-basis`; `finding-has-control`; `capacity-exceeded` (sum of accepted obligations' recurring cost vs `steering/roles.md`); `ca-write-boundary` (adapter attempted to write to a program-authored directory).

**Personas:** `business-owner` reviewer plays the counterparty's real interest at the Why gate and refuses ritual; `risk-assessor` names compliance anti-patterns once; `assurance` carries the attestation doctrine ("your controls; the auditor's say is peer-review defensibility"); a `finding-triage` skill (not a new persona) attaches to `assurance` and `risk-assessor`.

**Composer routing:** any request naming a framework, a platform, an auditor, a questionnaire or "for compliance" routes to the `obligation` scope, never straight to a control or task.

## What this is not

Not anti-compliance. Attestations win deals and satisfy regulators; the harness helps a company earn them with controls it actually runs. Not a refusal to use compliance platforms; it fixes their role. Not a vulnerability-management product; it fixes the vocabulary so the one that exists gets fed the right things.

## Open items

1. Should `obligations/` live under GOVERN (as proposed) or as a silo under inventory? *Lean:* GOVERN — obligations are promises, authored and decided, not observed.
2. Default disposition vocabulary — six values proposed; does `satisfy-minimally` earn its place, or is it `satisfy` with a scope statement? *Lean:* keep it; naming the minimal path is the whole point.
3. Exploitability determination — a deterministic pre-pass (reachability from inventory: exposed surface, auth required) before the persona judges? *Lean:* yes; the non-deterministic layer is a reviewer, never the calculator.
