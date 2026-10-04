# AI-RBC-DLC — Plan v0.3

**Artificial-Intelligence Risk-Based Control Development Life Cycle**
A Claude-only, git-based harness that *builds* a risk-based control program for a company, in that company's own repository, by steering strongly toward one proven way of thinking — without shipping the author's own program.

**Status:** consolidated plan, 2026-10-02. Supersedes v0.1/v0.2 and absorbs Addendum A (compliance as input), Addendum B (compliance module), the PCI posture ladder, the compliance-automation steering, and the decisions below. The detail documents remain beside this plan in `docs/` and are referenced rather than repeated. This file is the first steering document the harness is built from.

---

## 0. Decisions (stamped)

| # | Decision | Status |
| --- | --- | --- |
| D1 | Everything lives in git. No Airtable, no inventory database, no platform as store, in the finished product. | **DECIDED 2026-10-01 (Karl)** |
| D2 | Engine: TypeScript on Bun. | **DECIDED 2026-10-01 (Karl)** |
| D3 | Public core; private overlays. Must serve four contexts: personal, open-source framework, commercial, day-job safe. | **DECIDED 2026-10-01 (Karl)** |
| D4 | Product name **AI-RBC-DLC**; repository **`airbcdlc-workflows`** (mirroring AWS's `aidlc-workflows`); license **MIT-0** (as AI-DLC, which lets us borrow its patterns and code). | **DECIDED 2026-10-02 (Karl)** |
| D5 | Canonical control-domain taxonomy: the author's. The 14-domain list in §7.5 is the working crosswalk until the author's file replaces it. | **DECIDED 2026-10-02 (Karl)** |
| D6 | Controls as **Shape + Doctrine + Coverage + Exemplars + Sources**, compiled per program by the **Control Compiler**; the author's catalogue is an optional, unadvertised source published at bentosecurity.org (index tier free, full tier commercial). | **DECIDED 2026-10-02 (Karl)** |
| D7 | Compliance is an **input** (the Obligation), never an origin; a dedicated **compliance module** (profiles · advisor · compile recipes · obligations). | **DECIDED 2026-10-02 (Karl)** |
| D8 | Compliance platforms and trust centers are **publication targets** — the bridge to auditors and prospects — never the system of record. "Vanta is a snapshot." | **DECIDED 2026-10-02 (Karl)** |
| D9 | A **risk core**: every node backs out to a small fixed set of top-level harms; the **Intake Reflex** engages and leads back. | **DECIDED 2026-10-02 (Karl)** |
| D10 | Build order: v0.3 → M0 scaffold (incl. risk core, Intake Reflex, `breakdown`) → M1 inventory → … | **DECIDED 2026-10-02 (Karl)** |
| D11 | Top-level harm set for the default profile. | Open — author to supply; default in §5.1 as placeholder |
| D12 | First brownfield test subject. | Open — lean: a fixture, then the author's own program |
| D13 | Carry ISO Annex A / TSC short titles in the open module, or ids + paraphrases only. | Open — counsel; conservative design adopted |
| D14 | oDeshi (the author's own Claude Code plugin, `wiicode/odeshi`) is retired as a standalone harness; its worthwhile parts are salvaged into this one (§10.1). | **DECIDED 2026-10-02 (Karl)** |

---

## 1. Mission

AI-DLC contains no application; it contains the method that builds applications. AI-RBC-DLC contains no security program; it contains the method that builds security programs. A company runs `/rbc` in an empty repository and comes out with a governed, inventory-grounded, risk-decided, evidence-producing program that lives entirely in git and looks — in structure, judgment and voice — like a program the author would have built, while every record in it is the company's own. The framework steers hard about what inventory to acquire, what a control must contain, how a risk is written and decided, who owns what, what cadence runs, and what compliance is for. It never hands over the author's catalogue, and it works with it when offered.

### 1.1 Four deployment contexts (requirements)

| Context | Demand on the design |
| --- | --- |
| Personal | Full fidelity to the method; the author is a customer of his own harness. |
| Open-source framework (bentosecurity.org) | Generic vocabulary in core; taxonomy, maturity dial and catalogue arrive as a framework profile / control source. |
| Commercial (Bento Platform) | Adapter *contract* in core; the Bento adapter, branding and defaults in a private overlay. |
| Day-job safe | No Bento nouns, customer names, identifiers, brand or commercial doctrine in core; programs isolated; nothing phones home; no catalogue inferable from shipped files. A leak test runs in CI. |

---

## 2. The repository model

Two kinds of repository, always: **the harness** (`airbcdlc-workflows`, public, the method) and **a program repo** per company (the data *is* the source code).

```
<company-program>/
  .claude/                      # /rbc skill, agents, rules (@-imports program steering), hooks
  rbc.config.yaml               # harness version, framework profile, sources (license class, pins), plugins, publish targets
  steering/                     # THE PROGRAM'S POSITION PAPERS (written through stages; DECIDED stamps inline)
    company.md  appetite.md  roles.md  maturity-targets.yaml  rules/{people,devices,systems,vendors}.yaml  overrides/<persona>.md
  harms/        H-01..H-07.md   # TOP-LEVEL HARMS — the root of the tree; executive-owned; tolerance-bearing (§5)
  tolerances/   T-01..T-07.md
  risks/        R-012.md  R-012a..e.md        # parent (mechanism → intermediate harm → top harm) + branches
  decisions/    2026-10-D-031.md             # disposition · owner · date · residual · review · PREMISES
  obligations/  O-014.md                      # compliance as input: source, counterparty, quoted requirement, cost, disposition
  inventory/    organization.yaml people/ devices/ access/ systems/ vendors/ data-stores/ training/ incidents/ sources.yaml
  mirrors/<source>/<date>/                   # raw snapshots, verbatim, never merged
  controls/     library/<CODE>.md  implementation/<CODE>.yaml
  policies/  evidence/  tasks/  findings/  monitoring/  scenarios/  knowledge/
  rbc/
    programkb/                  # program discovery output (brownfield understanding)
    intents/<YYMMDD>-<label>/   # per piece of work: state, audit shards, stage artifacts
    views/                      # COMPILED, never hand-edited: exposure-by-harm, register, one-metric, crosswalks, attention queues,
                                #   framework artifacts (SoA, PCI scope statement, SOC 2 description, CSF profile), trust-center, board summary
```

Git is the audit trail; a commit that changes `harms/`, `tolerances/`, `decisions/` or `steering/` is the signature; commit trailers carry provenance (`Rbc-Intent`, `Rbc-Stage`, `Rbc-Persona`, `Rbc-Run`). Non-git events go to per-intent audit shards (AI-DLC's pattern).

---

## 3. Steering — the center of gravity

The author's genre, found in his own `docs/steering/`: desire in the owner's words → strategy in one paragraph → map with counts → "what X is made of" → order of work → "what this is not" → open items stamped `DECIDED <date> (<owner>)`. Used at two levels.

**Framework steering (ships in core — how the author thinks)**

| Set | Carries |
| --- | --- |
| `steering/method/` | The field guide as doctrine: vocabulary, harm sentence, the 20-minute breakdown, eight anti-patterns (+ seven compliance anti-patterns), six intake refusals (+ three), four terminal dispositions, register design, tolerances, roles and cadence. "Accept is a normal answer; an undeclared acceptance is the only failure." |
| `steering/risk-core/` | The tree (§5): top-level harms, intermediate vocabulary, placement rules, the Intake Reflex, ask → risk tables, premises and re-opening, residual roll-up. |
| `steering/inventory/` | One file per curated silo (§6): why, minimum fields, sources, joins, freshness, attention policy, floor vs advancing. Example: `steering-example-inventory-people.md`. |
| `steering/domains/` | Control doctrine per domain (§7.2), including *the harms the domain exists to prevent* (the tree's upward edge) and the ask → risk table. |
| `steering/shape/` | Authoring rules per record type (control, policy, evidence, tolerance, decision, monitoring proposal, task, obligation). |
| `steering/program/` | Governance → Policy → Control → Operations → Audit; cadence; attention-first; the one metric; "decisions first, then risks, then performance"; "the PDF is operational, the deck is executive; end on asks." |
| `steering/compliance/` | Attestation vs certification vs contractual standard; obligations and the Why gate; the insurability → SOC 2 → ISO ladder and the PCI ladder (§8); compliance automation as snapshot (`steering-compliance-automation.md`); findings vs vulnerabilities. |
| `steering/house-rules/` | Voice ("specific, brief, no preamble, no truism that would survive replacing the company's name"); evidence ("No URL = no claim"; "Citations or nothing"); human gate ("Nothing agent-authored reaches the record ungated"; "Names, not values"); the calculator rule ("the non-deterministic layer is a reviewer, never the calculator"); and the Intake Reflex voice: **engage, never scold, lead back** — treat the person as a capable adult who hasn't finished the thought; name the pattern once; let the breakdown do the arguing. |

Loaded ambiently via `.claude/rules/rbc.md` @-imports and per stage via each stage's `## Steering` compartment; treated as the quality bar ("apply, don't recite").

**Program steering (in the company repo — how *they* decided)**: `company.md`, `appetite.md` (+ tolerances), `roles.md` (declared capacity), `maturity-targets.yaml`, `rules/*.yaml`, `overrides/` (AUTHORITATIVE per-persona blocks; a persona cannot be removed while overrides exist). Written through stages, never from scratch.

---

## 4. Inventory — opinionated acquisition, customer-owned data

Principles (from the author's platform, verbatim where it matters): entity-centric never tool-centric ("tool views are evidence about an entity, not the entity"); mirrors are temporary — "link, don't merge"; slugs and names as join keys; provenance on every record; lifecycle enums with intent states, retire never delete; freshness is a field and staleness is an exception; reconciliation is first-class and coverage is a metric; rules are data with framework defaults; attention-first ("a surfaced entity with no stated reason and no attached action is a bug"); no source, no fact.

**Fourteen essential silos** — organization · people · devices · access · systems (+ shared catalog pattern) · vendors · data stores · policies · controls (library + implementation) · risks/decisions/tolerances/harms · evidence · tasks (assurance cadence) · findings/incidents/work log · training — plus conditional network estate, license posture, questionnaire fact store, knowledge. Each ships as `steering/inventory/<silo>.md` + JSON Schema + default rules (minimum fields and ingestion paths in v0.2 §5.2, unchanged).

**Acquisition** is three stages: **sources-discovery** (the program's MCP configuration and files matched to adapter descriptors; a human approves the plan — discovery is agentic, ingestion deterministic), **ingest** per silo (raw snapshot → resolution → validation → provenance; CSV and Markdown first-class), **reconcile** (duplicates, orphans, cross-source disagreement, stale sources; coverage; needs-action queues). The Bento Platform is one adapter descriptor among others, living in the private overlay.

---

## 5. The risk core

### 5.1 The tree

Every risk-shaped thing in a program is a node on one tree with a **small, fixed root**. Conversations happen at any altitude; the record always resolves to the top.

```
tool            Huntress                         — a system in inventory; implements[] controls; evidence/findings hang here
control         WS1 EDR on workstations          — library + implementation; prevents[] intermediate harms via its capability
capability      anti-malware on endpoints        — a coverage expectation in a domain (steering/domains/*)
branch          malware on a workstation steals sessions and credentials      ← ONE disposition; owner outside security
parent risk     R-014 data and secrets leave the company because staff workstations run untrusted code   (mechanism → intermediate harm)
intermediate    leaks & secrets                  — controlled vocabulary (framework-supplied, extensible)
top-level harm  H1 Business damage from a security incident                   ← executive owner; tolerance(s)
```

**Roots (`harms/`)** — five to seven, executive-owned, each bounded by one or two tolerances; rarely change. Default set until the author supplies his own (D11): H1 business damage from a security incident · H2 regulatory and legal exposure · H3 loss of customer trust and revenue · H4 operational disruption · H5 financial loss and fraud · H6 unlawful handling of personal data. The field guide's "5–7 tolerance sentences" are statements about these roots — tolerances were the top of the tree all along.

**Intermediate layer** — a controlled vocabulary so the engine can resolve chains: data leaves our control · credentials/secrets compromised · an identity keeps acting after trust ended · unauthorized or undetected change · service unavailable or degraded · data lost or corrupted · financial flows manipulated · a third party's compromise reaches us · personal data processed unlawfully. Extensible per profile, never free text.

### 5.2 Six rules

1. **Every node backs out to a root, or it is a finding about the tree.** Generalizes "a control with no risk is a finding" to tools, vendors with privileged access, monitors, tasks, findings, intake items. Sensor `orphan-node`. Domain doctrine supplies the upward edge ("the harms this domain exists to prevent"), so the Control Compiler produces controls born wired into the tree.
2. **Placement is the first line of every answer.** Mention "Huntress" and the assessor resolves it through inventory and prints the chain before anything else; `rbc trace <node>` prints up, `rbc tree H1` prints down.
3. **Decisions attach where the owner can decide.** Tolerances at the root (executives); dispositions at the branch (business owner outside security); implementation at the control (security); evidence at the tool (engineering). Little conversations happen at the bottom and cannot quietly alter the top: "switch Huntress for CrowdStrike" is a control-implementation question on a branch whose disposition is already Mitigate.
4. **Decisions carry premises; premises move.** A decision records the inventory facts, control states and tolerance it rests on; sensors in every later stage compare and **re-open** the decision with the reason when one moves (the platform's evidence-mask pattern, generalized). This is how "risk evaluation is present in every stage" is implemented.
5. **Residual rolls up.** Branch residual from control health ("a mitigated risk resting on failing controls is quietly back to inherent"); parent residual as the aggregate of branches (field guide); root exposure as the roll-up compared to its tolerance. The executive view is five to seven rows.
6. **Same tree, five zoom levels.** Views by harm (executive), by risk (forum), by branch (assessor), by control (operations), by tool (engineering). The one metric — share of risks with a recorded decision and a named owner — is computed per root.

### 5.3 The Intake Reflex

The breakdown stage made anticipatory. Fires on any intake item whose shape is a response rather than a risk (a tool, a monitor, "for compliance," a scanner row, a questionnaire ask).

1. **Fire back, once.** Name the anti-pattern in a sentence, without editorializing: "'Monitor' is Detect — it finds what already happened and changes nothing about likelihood. Let's find the risk you're responding to."
2. **Infer the worry.** Do not ask "what risk did you mean?" — *propose.* From the ask plus inventory (remote hires? contractors? device standard? identity verification? which systems reachable from unmanaged devices?) plus the domain's **ask → risk table**, offer three to six candidate branches already placed on the tree, narrowed by what the inventory shows. Propose-then-approve; the human picks.
3. **Walk to the root — including the branch nobody says out loud.** "Monitor BYOD" → data copied to a personal device · shadow SaaS · a malicious insider · *a remote "employee" who is a foreign-state operative on a stolen identity working a laptop farm — insider access and sanctions exposure* → H2 regulatory/legal (DOJ, OFAC) and H1. When inventory shows remote hiring without verification, the harness names that branch factually and moves on.
   **Show, don't tell.** Each candidate branch arrives with an illustration (§5.4): a real precedent, cited, from the company's industry where one exists — or a constructed scenario told in the company's own terms, labeled as such. Immature businesses do not yet know what to be afraid of; they have to be shown before they can decide.
4. **Place the proposal.** The monitor goes where it sits: Detect, post-compromise half, on the branches it can see — with *what it cannot see* written down (who is at the keyboard; a laptop-farm session; data copied locally).
5. **Show what actually treats each branch** from the program's own coverage (identity verification at hire; geo and impossible-travel conditional access; managed devices or VDI for privileged access; least privilege; contract terms for contractors; onboarding that binds a verified person to an attested device), and force one disposition per branch with its owner.
6. **Surface the governance gap first** — draft the missing tolerance and name the executive it goes to — then **three moves with owners**. If the monitor survives, it enters through the monitoring-proposal form.

Voice: engage, never scold, lead back. The person is a capable adult who hasn't finished the thought; the breakdown does the arguing.

### 5.4 Illustration — precedents and constructed scenarios

A branch that no one has *felt* will not be decided. The harness attaches an illustration to every branch it proposes, of exactly two kinds, never blurred:

| Kind | What it is | Rules |
| --- | --- | --- |
| **Precedent** | A real incident, found by web search, that is this branch happening to a company like this one — breach disclosures, DOJ and regulator releases, CISA advisories, vendor post-mortems, industry reporting. | "No URL = no claim." Source, date and victim's sector recorded; the harness quotes a line and links; it never embellishes beyond the source; staleness checked on re-use. A precedent in the same industry moves the branch's likelihood to `precedent` or `probable` — the field guide's evidence-based rating, now with the evidence attached. Bounded search budget per branch; "not found in public sources as of <date>" is a valid result. |
| **Constructed scenario** | A one-paragraph story of the branch happening *here*, told in the company's own terms — their systems, vendors, roles and data from inventory — ending at the top-level harm and the decision it illustrates. | **Labeled** "Illustrative — not a real event" on every surface, including the compiled views and anything published. Grounded strictly in inventory ("never assume tools they don't have"). Vivid and sober, never fear-framed; no real victim named unless cited as a precedent; one paragraph; it exists to make the decision legible, not to sell the control. |

Both land in `scenarios/` with `kind`, `branch`, `source_url` (required for precedents), `industry`, `date`, `told_in_our_terms`, and feed the scenario table (IDENTIFY 2.3) and the Intake Reflex (step 3). The `risk-assessor` owns them; the `business-owner` reviewer may object to a constructed scenario as implausible for *this* company — which is itself information about the branch. SP 1353's caution applies: fictional material is "for illustrative purposes" and is never used as a template for a real record.

### 5.5 Records and sensors

`harms/` (new); `risks/` parents gain `top_harm`, `intermediate_harm`; `controls/library` gain `prevents[]` and `capability`; inventory systems gain `implements[]`; `decisions/` carry `premises[]`. Sensors: `orphan-node`, `premise-moved`, `residual-recomputed-from-control-health`, `harm-sentence`, `owner-outside-security`, `single-response`, `control-link`, `tolerance-referenced`, `decision-complete`, `monitor-complete`, `finding-not-risk`, `intake-refusals`. Register workflow: Identified → Assessed → **Decided** (Accept | Avoid | Transfer | Mitigate) → Treatment (Mitigate only) → Monitored.

---

## 7. Controls — Shape + Doctrine + Coverage + Exemplars + Sources

The author's 124 controls share a strict anatomy; that anatomy is the proprietary thing worth protecting and the thing that ships openly without giving away a single control.

- **7.1 Shape (open).** Code grammar; audit-facing Statement; 1–3 **harm sentences** (never a failure-mode list); Basic/Advanced Implementation; Guidance program — "why it matters" → **BASELINE / MINIMUM** (what a 20-person company does first) → 3–6 workstreams with checklists → **METRICS & VALIDATION** (outcome metrics) → **SCOPE CONSIDERATIONS** (with exclusions pointing at siblings) → **RESPONSIBILITIES** by role; framework alignment with honest uncertainty; one-paragraph **Intention**; ~200–250-word **Board summary**; joins to policies, tasks, evidence, systems in scope, risks treated, `prevents[]`. Sensors enforce it (`control-has-harm`, `baseline-is-doable`, `scope-has-exclusions`, `metrics-are-outcomes`, `no-over-commitment`).
- **7.2 Doctrine (open, written with the author).** `steering/domains/<domain>.md`: the harms the domain prevents (the tree edge), standing conditions typical at 50–500, Baseline vs Advancing, exclusions, the evidence that proves it, over-commitment traps, the maturity ladder with the domain's own level names, and the **ask → risk table** the Intake Reflex reads.
- **7.3 Coverage (open).** `coverage/<domain>.yaml`: what a complete domain addresses, as expectations with the intermediate harms they treat and the maturity at which they are expected. A program is measured against coverage; gaps are findings about the catalogue, never auto-filled.
- **7.4 Exemplars (open).** Three to six fully worked, generic controls as the quality bar.
- **7.5 Sources (pluggable, optional).** `rbc source add <path|url>`: compliance-platform exports, CSV, or a published catalogue (the author's, index tier free and unadvertised at bentosecurity.org; full tier commercial). A source *accelerates* `catalogue-adoption`; nothing is copied verbatim without the gate. Canonical domain taxonomy: the author's (D5); working crosswalk — Governance & Organization (OM, IT) · Risk Management (RM) · Human Resources (HR) · Awareness & Training (AT) · Identity & Access (AA, AC) · Change Management & SDLC (CM, SO18–20, SS) · Security Operations (SO) · Endpoints & Workstations (WS) · Data Security (DS) · Data Privacy (DP) · Continuity & Resilience (CR) · Incident Management (IM) · Vendor Management (VM) · Process Integrity (PI).
- **7.6 The Control Compiler.** `coverage expectation × domain doctrine × shape × the program's INVENTORY × tolerances & maturity target → draft → control-author grades; business-owner objects (STRONGEST OBJECTION + FALSIFIER) → human gate → controls/library + controls/implementation`. Law of the compiler, from the author's platform: **"Ground strictly in the provided inventory — never assume tools they don't have."** Implementation records carry `current_state`, `future_state[]`, `implementation_pct`, `coverage ∈ {active, planned, parked, blocked, at-risk}` (Parked is legitimate), `systems_in_scope[]`, `maturity_level`, `ca_bindings[]`. Template + assignment, never duplication.

---

## 8. Compliance — an input, with a module behind it

### 8.1 Posture (Addendum A)

Compliance enters GOVERN as an **Obligation** — `source` (customer contract, prospect questionnaire, regulation, insurer, acquirer, attestation sought, auditor, platform), `asked_by`, the **quoted** requirement, `why_they_want_it` (often smaller than the ask), `harm_served` or `none`, `capacity_cost` against declared capacity, `architecture_fit` from inventory, `disposition ∈ {satisfy, satisfy-minimally, negotiate, decline, transfer, defer}`, `owner` outside security, `controls[]` that satisfy it *after* they exist for their own reasons. Direction rule: crosswalks run from controls to criteria; a criterion with no control is a visible gap, never a mandate; a control whose only justification is a criterion or a platform check is a **compliance-origin control** and is held. The **Why gate** (six hard questions) runs on every compliance-origin intake item. Seven compliance anti-patterns (compliance as origin · platform as authority · framework as catalogue · scope by default · scanner output as vulnerability · pentest as ritual · documentation as security) join the field guide's eight.

### 8.2 The module (Addendum B)

`compliance/profiles/<fw>/` — each framework answers the same twelve questions (kind · scope · structure · requires/does-not · risk · flexibility · assessment mechanics · vocabulary · pragmatism · hooks · key refs · gaps) and ships `structure.yaml` (ids as data), `scope-rules.md` (applicability derived from inventory), `vocabulary.yaml`, `compile/*.md` (framework artifacts as views), `sensors.yaml`, `questions.md`, `sources.yaml` (license class: `public-domain` | `free-copyrighted` | `licensed-purchase`; licensed texts indexed locally, never committed — `rbc sources add --framework …`). A **Compliance Advisor** persona answers under a fixed contract (name the kind; scope test first; cite id/page; what the text does *not* require; program consequence; "not addressed" is valid; log the answer). Crosswalk rows carry `mapping_status ∈ {proposed, derived, validated}` with provenance (SP 1353). v1 profiles: SOC 2, PCI DSS v4.0.1 (+ KMO applicability test), ISO 27001 (+27002/27005/27017), NIST CSF 2.0 (public domain; full Core shipped).

### 8.3 The ladders

**Layer 0 — Insurability.** Before any attestation: do what insurers require so they pay without hesitation. The application is a set of **attested statements**; each becomes a tested promise proven continuously from inventory (MFA on email/remote/privileged from the IdP lane; EDR on every endpoint from devices; backups offline/immutable and *tested* from evidence runs; patch cadence; email authentication; EOL software; privileged access; awareness; an IR plan). Obligation `source: insurer`; sensor `insurance-attestation-drift` re-opens it when a premise moves — before renewal and before a claim; the policy is the instrument on Transfer decisions, with exclusions, sublimits and conditions (notification windows, panel vendors, consent before ransom) carried as fields; annual re-derivation from inventory, never copied forward.

**SOC 2 — four postures by commitment, and a separate depth axis.** Categories attest to commitments *already made* (DC 200.B), never ambition.

| Posture | Trigger | Categories | Domains that deepen |
| --- | --- | --- | --- |
| 0 Questionnaire-ready | prospects ask; none has refused a questionnaire | none — compile artifacts | baseline program |
| 1 Must have the report | procurement requires a report to buy | Security | CC1–CC9 via the register and controls |
| 2 Won't fail customers | SLA/uptime and confidentiality clauses in contracts | + Availability + Confidentiality | Continuity & Resilience, Security Ops, Data Security, vendor flow-down |
| 3 Data-centric, by role | processing *is* the service → PI; own privacy notice to individuals → P | + PI and/or Privacy | Process Integrity; Data Privacy |

Depth is the other axis: Type 1 → Type 2 short period → Type 2 twelve months aligned to customers' fiscal years → clean exceptions handled soberly → SOC 2+ when a regulated customer needs it → SOC 3 for general use. Sensors `commitment-without-category` (a gap to decide) and `category-without-commitment` (over-scoping). Vocabulary: "the report," never "cert."

**ISO 27001 — graduation, one page.** A program running this method *is* most of an ISMS (clause 6 is the register; the SoA is a compiled view; 27001 forbids controls without a risk behind them). Posture: a market or customer requires certification. The module says when it is warranted, compiles the artifacts (SoA, risk assessment and treatment plan, scope, policy index, roles), **prices the delta honestly** — the practiced clauses: internal audit, management review, competence and awareness *assessed*, continuity exercises, scheduled reassessments — and hands certification mechanics to a consultant or the body. Rule 3 restated: "ISO 27001 is a certifiable, risk-based management system. Procedural means documented *and practiced* — a policy only maintains risk; practice modifies it. The certificate rests on records of things having happened. The SoA is a view of your risk decisions, never a shopping list."

**PCI DSS — orthogonal, driven by where card data goes** (`compliance-pci-posture-ladder.md`): A outsourced/no PAN (stay here; 12.8, 12.10, own-page scripts) · B PAN in the business (**stop** — an Avoid decision; the SAQ D exposure view makes the price of not stopping legible; the Avoid decision's premise re-opens it when PAN reappears — "and stop again") · C security-impacting through a relationship (scope to what you touch; support the customer's assessment; the AOC route is a priced decision) · D payments entity (**hire experts**; the program is the QSA's best client and refuses to be the assessor). Posture derived from inventory and four questions, re-run on every sync.

**Compliance automation and trust centers** (`steering-compliance-automation.md`): the bridge, not the building. Published, not synced (one-way for authored content, enforced by the adapter); the picture has a date; edited is fine, staged is not. Buying one is a Transfer-of-exposure decision. "The platform shows; the program knows; the business decides."

### 8.4 Findings vs vulnerabilities (Addendum A, confirmed by the frameworks)

`finding.kind ∈ {vulnerability, misconfiguration, secrets, hygiene, tech-debt, product-design, coverage-gap}`; `exploitable ∈ {true, false, undetermined}` (scanner imports land `undetermined`); `exploit_basis` required when true; **SLA permitted only when `kind: vulnerability ∧ exploitable: true`**; `control_tested` required; `signal_route`; `layers` (the Swiss-cheese slices). ISO's and SOC 2's "vulnerability" import as `finding`; inside a PCI CDE the 6.3.1 rank is never suppressed and high/critical/CVSS ≥ 4.0 external are hard-remediated.

---

## 9. Phases, stages, scopes

Seven phases, 31 stages (v0.2's 29 + GOVERN 1.5 obligations-intake + ASSURE 6.5 framework-readiness). Stage files are YAML-fronted Markdown compiled to a graph, with `## Steps`, `## Steering`, `## Risk Check` (which harm and tolerance this output serves; `premise-moved` runs at every gate) and `## Sensors`.

| Phase | Stages |
| --- | --- |
| 0 INITIALIZATION | workspace-detection · state-init · program-discovery (brownfield → ProgramKB incl. register-assessment) · sources-discovery · inventory-ingest (per silo) · reconciliation |
| 1 GOVERN | intent-capture · risk-appetite (harms + tolerances) · accountability (roles, capacity, cadence) · maturity-targets · **obligations-intake** |
| 2 IDENTIFY | catalogue-adoption (if a source) · harm-register · scenario-table · breakdown (per intake item; **Intake Reflex**; reviewer business-owner) · **decide** (mob) |
| 3 POLICY | policy-set · policy-drafting (three-axis review) |
| 4 CONTROL | control-compile (per coverage gap) · control-calibration · evidence-design · detection-sizing · framework-crosswalk (mapping status) |
| 5 OPERATE | intake-triage (refusals + Why gate) · task-distribution · inventory-sync (premise sensors fire) · treatment-tracking |
| 6 ASSURE | evidence-collection · control-testing (finding triage) · periodic-review (stateful: prep → brief → shown → decisions → held/next) · audit-package (per framework compile recipes; publish to platform/trust center) · **framework-readiness** (practiced-clause pricing → disposition) |

Scopes: `breakdown` · `intake` · `inventory` · `catalogue-adopt` · `founder` (≤50) · `growth` (50–150) · `scale` (150–500) · `obligation` · `compliance-advisory` · `framework-readiness` · `audit-prep` · `review`. Depth within a domain is the maturity dial, not the scope.

---

## 10. Personas and agents

Format and discipline from the OpenDeshi roster (16-section full / 2 KB compact; shared preamble; PERSPECTIVE block; HANDBACK with STRONGEST OBJECTION + FALSIFIER; mandatory pair; **cross-domain reviewer**; red/amber lint). Assembly from the platform personas (charter + skills + program context at call time; house skills research · brevity · format unioned in; AUTHORITATIVE per-program overrides; "every persona needs a human expert"; autonomy `analysis | read | act`).

Roster: `accountable-seat` (mandatory; governance tie-breaker) · `business-owner` (mandatory adversarial reviewer; outside security; refuses pre-set treatments, slashes, tool-named risks, monitoring-as-response; accepts without stigma) · `risk-assessor` (owns the Intake Reflex and breakdown; proposes, never decides) · `control-author` (compiler and grader) · `inventory-steward` · `policy-author` · `assurance` (auditor's eye; crosswalk validation) · `cadence-reviewer` · `compliance-advisor` · `composer` (routing: anything naming a framework, auditor, platform, questionnaire or "for compliance" → `compliance-advisory` first).

Human-gate vocabulary carried verbatim: propose-then-approve; analysis-only unless a registered act-tier slug; `authorized` set only by a human action; verify-before-Done; agent-owned fields; sign your own writes; "when unsure, do not mutate — surface it"; bounded effort with `[PARTIAL — TIME CAP]`; silent run when nothing to say; on-demand for costly judgment; prompt-as-data.

### 10.1 From oDeshi — what overrides AI-DLC

The author's own harness (`wiicode/odeshi`; full salvage in `_study/study-odeshi.md`) is retired, and nine of its ideas are *better* than AI-DLC's equivalent and override it here:

1. **Bounded iteration.** Every gate is wrapped in oDeshi's circuit breaker — three revision cycles or two hours, then four fixed exits (escalate, narrow scope, accept with dissent recorded, stop) — plus its three early-warning signals (a soft reviewer, scope mismatch, a bypassed stakeholder). AI-DLC's Redo is unbounded; a risk program cannot afford that.
2. **Dissent is a first-class output.** TENSIONs are protected through synthesis; a DISSENT carries a revisit trigger; Complex-tier decisions require a steelmanned alternative. In a risk program the overruled position is often the one the auditor asks about.
3. **The adversarial review record.** `FAILURE MODES TESTED` (each with result and evidence), `#1 PROBLEM` stack-ranked, `CONFIDENCE CALIBRATION`, `VERDICT`; a bare "no concerns" is rejected; reviewer output is forwarded verbatim while analysts are compressed. This is the `business-owner` reviewer's output shape.
4. **Provenance-driven severity.** A finding becomes *Hard* when two stakeholders or a domain authority back it; otherwise Soft or Context. This is how a finding earns the right to block.
5. **Reversibility in the decision record.** ADR fields — decision drivers, reversibility, one-way-door, validation plan, approved-by — join the decision schema, and approval scrutiny scales with irreversibility (a one-way door gets a pre-mortem and an explicit human approval; a reversible choice does not).
6. **Facts decay.** Validated date, 90-day review, quarterly re-validation, move-don't-copy — "no source, no fact" gains a time axis, applied to inventory facts, precedents (§5.4) and compliance mappings.
7. **A communication signal gate** — "one event, one post"; decide *whether* to communicate before *how*; the brief shape aligns to "decisions first, then risks, then performance."
8. **Empirical health checks** — probe, don't infer. A `health-check` skill runs the program-level sensors (ownerless in-progress work, blocked-by-closed, stale facts, volatile state committed, orphan nodes) as a sweep.
9. **The CI shape.** `CATEGORY | FILE | LINE | DETAIL` failures; fixture directories with self-validating mutators; drift canaries with value anchors in a single `contracts` home; referential-integrity and stdout-leak tests; a pinned CLI. The leak test and the licensed-text guard are built on this.

Also carried: the Intake command's read-before-scope, stated rationale, confirm-before-write, discard-on-decline and **deduplicate** (the Intake Reflex gains a dedupe step); the single-dispatcher hook pattern (stdout = JSON, stderr = human; degraded paths exit 0 with an empty envelope); the plugin manifest and self-marketplace install; the commit-trailer gate re-purposed to name the human authorizer on `steering/`, `harms/`, `tolerances/` and `decisions/` changes. Dropped: the generator pipeline, legacy shims, agent-teams fallback, the issue-tracker abstraction, hard-coded model ids, and manager self-rotation (it conflicts with "every persona needs a human expert").

---

## 11. Engine (TypeScript on Bun), plugins, licensing

Borrow AI-DLC's patterns, not its surface: `graph compile --check` · `orchestrate next/report` · state and audit shards · `schema validate` (JSON Schema 2020-12) · `sensors run` · `views compile` · `sources` (descriptors, MCP discovery, CSV/MD importers, mirrors, resolution) · `control-source fetch` · `trace / tree` · `publish` (compliance platform, trust center) · hooks (session-start, write-audit-log, run-sensors, state-transition-guard, plan-approval-guard). Dropped: swarm, bolts, walking skeleton, CI/deploy stages, testing contracts, worktree merge-back.

Plugins and profiles: **framework profile** (domains, codes, maturity-level names, crosswalks — generic in core; the public framework at bentosecurity.org ships its own); **control source**; **adapter descriptor** (reads and publishes declared separately; no descriptor reads authored content; the Bento Platform descriptor is in the private overlay); **overlay plugin** (branding, defaults, extra personas/stages; `bento-overlay` is private). Three **license classes** enforced by the engine; a sensor refuses commits containing licensed text; the leak test runs in CI on core.

---

## 12. Build sequence

| Milestone | Delivers | Proves |
| --- | --- | --- |
| **M0 — Steering, schemas, risk core, skeleton** (wk 1–2) | Repo layout; `rbc init`; `/rbc`; `harms/`, `tolerances/`, `risks/`, `decisions/`, `obligations/`, `monitoring/`, `findings/` schemas; method + risk-core + house-rules + inventory (14 files) + compliance steering; persona format, preamble, lint; the adversarial review record and circuit breaker at gates; ADR fields on the decision schema; `trace`/`tree`; the seven risk sensors + `orphan-node`; the CI validator shape (fixtures, canaries, leak test); `breakdown` with the **Intake Reflex** end to end on a thin Markdown inventory. | The field guide's two worked examples reproduce; "we'll monitor BYOD" walks to H2 with branch (d) named and the monitor placed with its blind spots. |
| **M1 — Inventory acquisition** (wk 3–4) | Adapter descriptors (CSV, Markdown, IdP/MDM/EDR/compliance-platform shapes); sources-discovery; ingest + mirrors + resolution; reconciliation; attention views; `implements[]` wiring tools to controls. | A fixture company ingested from CSV + one MCP source; duplicates/orphans/stale with reason + fix; `rbc trace huntress` prints a chain. |
| **M2 — Decide, premises, cadence; engine v1** (wk 5–6) | `decide` (mob); premises and `premise-moved`; exposure-by-harm, register, one-metric views; intake refusals + Why gate; `intake`, `review`, `obligation` scopes; graph, next/report, state, audit, gates, hooks. | A dry-run month: triage → decide → review; a control's implementation drops and the decision re-opens. |
| **M2.5 — Compliance skeleton + CSF** (wk 6) | `compliance/` layout; PROFILE-SCHEMA; `nist-csf-2` with the public-domain Core; `fw-id-exists`, pinned versions, `mapping_status`; Organizational Profile recipe; `compliance-advisor`; `compliance-advisory` scope. | A cited answer to "does CSF require X?"; a compiled Profile ending in Assumptions & Evidence Gaps. |
| **M3 — Controls, policy, SOC 2, PCI, insurability** (wk 7–9) | Shape + sensors; 14 domain doctrine files (with the author) incl. ask → risk tables; coverage; exemplars; the Control Compiler; control sources; `catalogue-adoption`; policy-set + three-axis drafting; `soc2` and `pci-dss` profiles with scope-rules from inventory and compile recipes; the four PCI postures and four SOC 2 postures as playbooks; insurability obligation + `insurance-attestation-drift`; `founder`, `growth`, `catalogue-adopt`, `audit-prep` scopes. | A fixture with no source compiles a full Identity & Access domain from its inventory; the same fixture with the author's index source adopts and re-shapes; a BYOD company lands in PCI posture A and SOC 2 posture 1 with the right duties and nothing more. |
| **M4 — Operate, assure, ISO, publish** (wk 10–12) | Tasks + distribution; evidence by name; control testing → findings; periodic review (stateful); audit packages per framework; `iso-27001` profile, `rbc sources add` for licensed texts with the commit guard, SoA and treatment-plan recipes, `framework-readiness`; `publish` to compliance platform and trust center with provenance and `snapshot-age`; `scale`, `framework-readiness` scopes. | Evidence "unwired" gaps surface; a failing control test re-opens its decision; the deck ends on asks; "Vanta says green" is evaluated against the program. |
| **M5 — Profiles, overlays, publish core** (wk 13–14) | Generic framework profile; `bento-overlay` (private: descriptor, profile, brand, source pointer); leak-test CI; docs; public release of `airbcdlc-workflows`. | The author runs the same harness in all four contexts with no content crossing between them. |

M0 is where the author's judgment is captured; domain doctrine (M3) is the one piece that needs his hours.

---

## 13. What this is not

Not a GRC platform; not a compliance platform or a replacement for one (it publishes to them); not an assessor (never "in place," a certificate, or an opinion); not a scoring engine (no heat-map arithmetic, no invented composite — every grade states its rule); not a library of the author's controls; not a service-delivery system (no billing, no touches, no client success); not anti-compliance — it earns attestations with controls the company actually runs.

## 14. Open items

1. The author's top-level harm set (D11) and his canonical domain file (D5).
2. ISO/IEC 27001:2022 and the AICPA TSC/DC texts are not in the source set; acquire before encoding clause and criterion keys (and resolve the 27001 clause-10 numbering).
3. PCI *SAQ Instructions and Guidelines* — every SAQ statement in the PCI ladder is marked `[verify SAQ docs]`.
4. Counsel on carrying ISO/TSC short titles (D13).
5. Posture-B PAN detection sources the harness can realistically read (DLP, mailbox/CRM scans); without one, Q1 stays `undetermined` and the advisor says so.
6. Which compliance platforms get first-class descriptors in core; whether the trust-center publisher is core or plugin.

---

*Companion documents in `docs/`: `AI-RBCDLC-ADDENDUM-A-compliance.md`, `AI-RBCDLC-ADDENDUM-B-compliance-module.md`, `compliance-pci-posture-ladder.md`, `steering-compliance-automation.md`, `steering-example-inventory-people.md`; private study notes in `_study/` (platform studies; framework profiles — these quote licensed texts and never ship; `study-odeshi.md`).*
