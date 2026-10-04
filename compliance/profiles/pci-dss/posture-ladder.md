# PCI DSS — posture ladder and playbooks

**Status:** working position 2026-10-02, from the author's field experience with the companies this tool is for; becomes `compliance/profiles/pci-dss/scope-rules.md` and `playbooks/`. Cites PCI DSS v4.0.1 by page/requirement. SAQ eligibility rules live in the *SAQ Instructions and Guidelines* and in acquirer/brand programs, which are **not on hand** — every SAQ statement below is marked `[verify SAQ docs]`.

## The desire, in the author's words

> Most customers accept credit cards through a third party and never store — SAQ A. Some make the bad choice of taking cards over the phone or some other way where they need to be told to stop, and stop again; if they don't, they get a probe with SAQ D. Few are security-impacting because they work with someone that is in scope. Rarely are there processors, but this is evolving — for these we steer them to deep, QSA-level evaluations. They need to hire experts.

## The strategy, in one paragraph

PCI applicability is a fact about *where account data goes*, so the module derives posture from inventory and four questions, not from what the company says it is. Four postures cover the audience. For each, the advisor has one standing recommendation, one set of duties that actually apply, one set of decisions the business owner must record, the artifacts the program compiles, and the sensors that move a company between postures. The ladder is designed so that the cheap posture (A) is the default, the expensive one (B) is made *visibly* expensive, the relational one (C) is scoped to what the company actually touches, and the dangerous one (D) is handed to professionals with the program producing the inputs.

## The four questions (asked of inventory first, people second)

| # | Question | Inventory source | Fallback |
| --- | --- | --- | --- |
| Q1 | Does any system, data store, or channel store, process or transmit PAN or SAD? | `data-stores/` classification includes `pan`/`sad`; `systems/` `data[]` includes `cardholder-data`; flows; **channels** (phone, paper, email, chat, CRM notes, support tickets, call recordings, spreadsheets) | asked plainly; "we don't think so" is `undetermined`, not `no` |
| Q2 | How do customers pay us? | `systems/` payment entries with `integration ∈ {hosted-redirect, iframe, embedded-fields, direct-api, virtual-terminal, moto, in-person, none}`; `vendors/` processor with AOC on file | asked; the integration pattern is the single most consequential fact |
| Q3 | Do we provide a service to anyone who is in PCI scope, and could our service impact the security of their CHD? | `obligations/` with `source: customer-contract` mentioning PCI; `vendors/`/customers with `pci_scope: true`; `systems/` we operate inside a customer's environment | asked; "they sent us a PCI questionnaire" is a yes until shown otherwise |
| Q4 | Are we a payment facilitator, gateway, processor, ISO, or do we move payments on behalf of others? | `steering/company.md` business model; revenue lines | asked |

PCI's own framing for Q1/Q3: an entity is in scope if it stores, processes or transmits CHD/SAD **"or could impact the security of"** CHD/SAD (p.4); "the primary account number (PAN) is the defining factor" (p.5). Posture is recorded on the organization record with the four answers, dated, and re-derived on every inventory sync.

## The ladder

```
Q4 yes ───────────────────────────────────────────────► D  Payments entity        — QSA-level; hire experts
Q3 yes (and not D) ───────────────────────────────────► C  Security-impacting provider — customer-driven, scoped
Q1 yes / undetermined (PAN in the business) ─────────► B  PAN in the business    — avoid first; SAQ D as the price of not stopping
Q1 no, Q2 ∈ {hosted-redirect, iframe}, processor AOC on file ──► A  Outsourced, no PAN — SAQ A-shaped
```

Precedence is top-down: a D is a D even if it also outsources its own checkout; a C that also takes phone orders is B *and* C (two obligation records, two playbooks).

---

## Posture A — Outsourced, no PAN (most companies)

**Shape.** Payments run through a validated third party by hosted redirect or iframe; the company's systems never see PAN or SAD; paper receipts at most. This is the posture the acquirer will usually validate with **SAQ A** `[verify SAQ docs: eligibility — all processing outsourced to PCI DSS validated TPSPs; no electronic storage, processing or transmission of account data on the merchant's systems; for e-commerce, payment-page elements delivered to the consumer's browser originate only from a compliant TPSP]`.

**Standing recommendation.** Stay here. Treat every proposal that would bring PAN onto company systems or channels as a move to Posture B and price it before anyone says yes.

**What actually applies (from the standard, p.5, 12.8, 12.10):**
- **12.8 — the TPSP relationship**, in full: list of TPSPs with services (12.8.1); written agreement with the TPSP's acknowledgment of responsibility (12.8.2 — an AOC "is not a written acknowledgment," p.317); due diligence before engaging (12.8.3); annual monitoring of their compliance status (12.8.4); a responsibility matrix of which requirements each party performs (12.8.5).
- **12.10 — an incident response plan**, including brand/acquirer notification; "applicable to all entities" (p.5).
- **Own payment-page scripts (6.4.3 / 11.6.1)** — in the standard these apply to scripts on the merchant's page that loads the payment form (p.153, p.286); whether SAQ A requires them depends on the current SAQ A eligibility wording `[verify SAQ docs — the 2025 SAQ A revision changed this]`. The honest program answer is independent of the SAQ: know every script on the checkout page and who owns it.
- **SAD never stored** (p.6) — a rule even for environments with no PAN.
- Whatever the acquirer's SAQ A asks, annually `[verify SAQ docs]`.

**Decisions the business owner records.** `O-pci-a` obligation → **satisfy** (SAQ A annually, owner: finance/ops); the processor relationship as a **transfer** decision (the control is theirs; the contractual responsibility is ours — PCI p.16: "Use of a PCI DSS compliant TPSP does not make a customer PCI DSS compliant").

**Compiled artifacts.** TPSP list + responsibility matrix (12.8.1/12.8.5) from `vendors/` × obligations; IR plan from `policies/`; checkout-script inventory from `systems/`; the SAQ A working paper with evidence pointers (the AOC and SAQ themselves are PCI SSC forms, p.33).

**Recurring tasks.** Annual: SAQ A, AOC collection from the processor, agreement review, IR plan test (12.10.2). On change: payment integration change → re-run the four questions.

**Sensors that move you.** `pci-pan-detected` (Q1 flips) → Posture B; new contract with a PCI clause (Q3) → Posture C; a product decision to embed payments (Q4) → Posture D.

---

## Posture B — PAN in the business (the ones who need telling, twice)

**Shape.** Someone takes card numbers over the phone and keys them into something; cards arrive by email, chat, web forms, or in support tickets; numbers are written on paper, typed into the CRM, or captured in call recordings. Each is a channel through which PAN enters the company's systems. The acquirer's validation shape is **SAQ D** — essentially the whole standard, roughly 250 requirements `[verify SAQ docs]` — unless the only channel is staff keying into the processor's virtual terminal on an isolated device, which may qualify for a narrower SAQ `[verify SAQ docs: SAQ C-VT eligibility]`.

**Standing recommendation. Stop.** This is a textbook **Avoid** decision in the program's vocabulary and in PCI's own words: "Restricting account data to as few locations as possible by eliminating unnecessary data and consolidating necessary data may require reengineering of long-standing business practices" (p.12). The alternatives are standard: pay-by-link sent from the processor; the processor's hosted virtual terminal; a hosted payment page for the web form; refusing cards by email and chat with an auto-reply that sends a link. For data that already arrived through an unintended channel: "Securely delete the data and implement measures to prevent the channel from being used in the future" (p.14).

**The probe — making the price visible.** When the business will not stop, the advisor does not argue; it compiles the **SAQ D exposure view**: the full set of requirements that becomes "in place / not in place" for *every* system the PAN touches (flat network → "the entire network is in scope," p.12), the recurring duties that come with it (quarterly internal scans 11.3.1; quarterly ASV external scans 11.3.2; annual internal and external penetration tests 11.4.2–11.4.3; segmentation tests if segmentation is claimed 11.4.5; daily log review 10.4.1; file-integrity monitoring 11.5.2; the whole of Requirements 3 and 4 for stored and transmitted PAN), the one-time build, and the hours against the capacity declared in `steering/roles.md`. "Requirements are not considered to be in place if controls are not yet implemented or are scheduled to be completed at a future date" (p.33) — there is no partial credit. The view ends with the two dispositions side by side: *avoid* (stop taking cards this way; cost of the alternative) or *accept SAQ D* (the priced load, signed by the business owner, with the acquirer named as the party who will ask).

**Decisions the business owner records.** `O-pci-b` → **avoid** (preferred; owner: whoever runs the channel — sales ops, support lead; premise: "no PAN enters channel X") or **accept** the SAQ D load with the compiled price attached and a 90-day review. Either way the risk row exists: *customers suffer card fraud and the company suffers fines and acquirer action because card numbers sit in systems built for something else*.

**"And stop again."** The Avoid decision carries the premise "no PAN in channel X." Inventory sync and any DLP/scan source feed `pci-pan-detected`; when PAN reappears in support tickets, the CRM, mailboxes or recordings, the decision **re-opens** automatically with the exposure view attached and the owner's name on it. A second re-open within the review period is a standing finding at the top of the needs-action queue — not a reminder, a priced decision waiting for a signature. Repeat offence is what the attention policy is for.

**Compiled artifacts if they accept.** Scope statement and annual confirmation (12.5.2); component inventory (12.5.1); network and data-flow views (1.2.3/1.2.4); 6.3.1 ranking process; TRAs for the nine frequency-flexible requirements (12.3.1); the timeframe calendar (Table 4); SAQ D working papers.

**Sensors.** `pci-pan-detected`, `pci-scope-vs-chd` (both directions), `pci-timeframe-window`, `pci-rank-never-suppressed`, `capacity-exceeded`.

---

## Posture C — Security-impacting through a relationship (a few)

**Shape.** The company does not touch PAN but provides a service to someone who does, and the service "could impact the security of" their CHD: managed infrastructure or devices inside a customer's environment, software deployed into a CDE, a system with connectivity to one, authentication or logging a customer relies on, code or deployment tooling that reaches in-scope systems (PCI's bucket (c), p.9–10). PCI calls this a **service provider**: "companies that provide services that control or could impact the security of CHD and/or SAD" (p.391). The customer's duty to you is 12.8; your duty to them is to be able to answer it.

**Standing recommendation. Define exactly what you touch, bind it contractually, and support the customer's assessment — do not self-assess the whole company.** PCI offers two routes for a TPSP (p.18): an annual assessment with an AOC you share, or "on-demand assessments / participation in each customer's assessment." For a company that touches one slice of one customer's environment, the second is usually right; the first becomes right when several customers ask.

**What actually applies.** The requirements that cover the services you perform *for* the customer — determined with them and recorded in a **responsibility matrix (12.8.5)** from your side; written agreement acknowledging responsibility (12.8.2); your own 12.8/12.10 for your sub-providers and incidents affecting their data. If you take the AOC route, the 17 service-provider-only requirements come into play (12.4.1 executive accountability, 12.4.2 quarterly reviews, 12.5.2.1 six-monthly scope confirmation, 11.4.6 six-monthly segmentation tests, 12.9.1–12.9.2 written acknowledgment to customers and information on request) and Appendix A1 if you are multi-tenant (p.335).

**Decisions the business owner records.** `O-pci-c` per customer → **satisfy-minimally** (responsibility matrix + participation in their assessment; owner: the account owner) or **satisfy** (your own SP assessment and AOC; owner: the executive who signs 12.4.1) — the second is a capacity decision priced against `steering/roles.md`, usually triggered by the second or third customer asking. Risk row: *a customer suffers a breach of their CDE because a component we operate for them was the path in* — the mechanism is named from your systems inventory.

**Compiled artifacts.** Per-customer responsibility matrix (12.8.5) from `systems/` we operate for them × requirements; the written-acknowledgment text (12.9.1 if SP); the list of our in-scope-for-them components with owners; our own TPSP list.

**Sensors.** New customer obligation with a PCI clause → re-derive; a change to what we operate for an in-scope customer (`systems/` delta) → responsibility matrix stale; count of customers asking ≥ N → readiness view for the AOC route.

---

## Posture D — Payments entity (rare, and growing)

**Shape.** The company is, or is becoming, a payment facilitator, gateway, processor, ISO, or embeds payments into its product on behalf of others. PAN flows through systems the company builds and runs; PCI DSS applies in full as a service provider; a ROC by a QSA (or ISA) is the likely validation; Appendix A1 applies if multi-tenant; the customized approach becomes available and attractive — and "intended for risk-mature entities that demonstrate a robust risk-management approach to security" (p.28). Adjacent PCI programs may also apply: PIN, P2PE, SSF for payment software, 3DS, and — only for key-management service types (KIF, HaaS, CA/RA, signing, PIN processing, decryption management) — **KMO**, which has no customized approach and no compensating controls (KMO p.28, p.34).

**Standing recommendation. Hire experts.** The advisor's job here is to say so clearly and early, and to make the program the best possible *client* of a QSA: inventory-true scope, compiled diagrams, a real TPSP matrix, TRAs on the template, decisions recorded. The harness never grades a requirement "in place," never substitutes for a ROC or AOC (official PCI SSC forms, p.32–33), and never recommends the customized approach on its own. It refuses to be the assessor.

**What the program does.** Everything compiled in Posture B, kept continuously (service providers confirm scope six-monthly, 12.5.2.1); the SP-only requirements; the 12.4.1 executive accountability record; Appendix A1 multi-tenant controls; a QSA engagement recorded as an obligation with an owner and a budget; the one-screen KMO applicability test; a readiness view that lists what the QSA will ask for and what exists.

**Decisions the business owner records.** `O-pci-d` → **satisfy** with a named QSA engagement (owner: the accountable executive, 12.4.1); becoming a payments entity is itself a GOVERN decision with tolerances re-opened (the company's appetite changed — 27005 §6.1's "as it grows, it can lower its risk appetite" in practice).

**Sensors.** Q4 flips (product roadmap, revenue line) → `posture-d-entered` → readiness view + "engage a QSA" as the first needs-action row; any attempt to compile an AOC → refused with the reason.

---

## Vocabulary the advisor uses in this ladder

- "SAQ A-shaped / SAQ D-shaped" — the *shape* of the validation the acquirer will likely ask for; the SAQ type is the acquirer's and brand's call, from the SAQ instructions `[verify SAQ docs]`, never the module's ruling.
- "In scope" vs "security-impacting" — PCI's buckets (a)/(b) vs (c) (p.9); both are CDE.
- "Stop" is an Avoid decision with a premise; "accept SAQ D" is an Accept decision with a price. Neither is a reminder.
- Never: "PCI compliant" as a state the module confers; "certified"; "passed."

## What this is not

Not an SAQ selector (the eligibility rules are the acquirer's and live in documents not on hand); not a QSA; not a scope-reduction consultancy for Posture D; not a replacement for the processor's AOC. It is the thing that keeps Posture A companies in A, makes B's price legible, scopes C to what is actually touched, and gets D into professional hands with a clean inventory.

## Open items

1. Acquire the *SAQ Instructions and Guidelines v4.0.1* and the current SAQ A / C-VT / D eligibility text; replace every `[verify SAQ docs]`.
2. Resolve whether 6.4.3/11.6.1 appear in current SAQ A or only as an eligibility confirmation — affects Posture A's recurring tasks.
3. Posture B detection sources: which inventory or DLP signals the harness can realistically read for PAN in support tooling, CRM, mailboxes and recordings; without a source, Q1 stays `undetermined` and the advisor says so.
4. Posture C threshold for recommending the AOC route (number of asking customers, revenue share) — a program rule in `rules/`, with a framework default of "the second customer."
