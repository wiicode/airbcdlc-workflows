# AI-RBCDLC — Addendum B: The Compliance Module

**Status:** working position 2026-10-02, after a full read of the source set (PCI DSS v4.0.1; PCI KMO v1.0; ISO/IEC 27002:2022, 27005:2022, DIS 27017; NIST CSF 2.0 with SP 1300/1301/1303/1305/1353 ipd; AICPA SOC 2+ guidance). Supersedes the framework rules in Addendum A §"grounding rules" where they differ. Companion: four framework profiles in `_study/frameworks/` (private — see §8).

## Why a module

Addendum A made compliance an *input* (the Obligation) and gave the harness the Why gate. That is the posture. What it lacks is **knowledge**: the ability to answer, with a citation, "does PCI apply to us?", "does SOC 2 require a pentest?", "what would ISO certification actually cost us in practice?", "which of our controls cover CC7.1?", and to compile the artifacts each framework wants from the program the company already runs. The deep read showed each framework has its own kind, its own vocabulary, its own flexibility points, and its own copyright terms — enough structure that a dedicated module with a uniform profile shape is the right answer, and enough difference that one generic "frameworks" steering file would get them wrong.

The module does four things: **profiles** (what each framework is, requires, allows, and how it maps), an **advisor** (cited answers, direction, refusals), **compile recipes** (framework artifacts as views of the program), and the **obligations pipeline** from Addendum A (where compliance enters).

---

## 1. Corrections from the deep read

### 1.1 ISO — "be more careful" (replaces Addendum A's rule 3 treatment)

Addendum A said "ISO is procedural; Annex A is coverage; a capacity decision." Each is half right. The precise position:

- **Four documents, one name.** Only ISO/IEC 27001 is a *requirements* standard ("shall") and the only one you can be **certified** to. 27002 is "a reference set of generic information security controls including implementation guidance" with "no normative references"; 27005 is guidance for the risk clause; 27017 (on hand as a 2025 draft) "excludes any and all aspects of conformity assessment" and reaches a certificate only by extending a 27001 SoA with its CLD controls. The module never says "27002-certified" or "27017-certified."
- **Certification is not attestation.** A SOC 2 report is a CPA firm's opinion on management's assertion for a period. An ISO certificate is an accredited certification body's decision that a *management system conforms to a requirements standard*, kept by annual surveillance over a three-year cycle. Different authority, different artifact, different vocabulary (conformity / nonconformity / corrective action).
- **27001 is risk-based by construction — and the chain runs one way.** Risks → treatment options → necessary controls → Annex A *safety check* → Statement of Applicability. "Only controls identified in the risk assessment can be included in the SOA. Controls cannot be added to the SOA independent of the risk assessment" (27005 §8.5). The Annex A comparison "is not in place to identify any omitted controls from … Annex A" but "to identify any missing necessary controls from any source" (§8.4). The organization "can design controls as required or identify them from any source" (27002 §0.4). **The SoA is therefore a compiled view of the program's decisions, never a shopping list** — ISO itself forbids the "framework as catalogue" anti-pattern.
- **"Procedural" means documented *and practiced*, and ISO says why.** "An information security policy … can only maintain risk, whereas compliance with the information security policy can modify risk" (27002 §0.3). The certificate rests on *records of things having happened*: internal audit, management review, awareness with understanding "assessed," continuity plans "regularly evaluated through exercises and tests," risk assessments "performed in accordance with that schedule," corrective action re-verified. Documenting is cheap; practicing is the cost. 27002 §5.37 even limits *when* to document a procedure (performed by many, performed rarely, new and risky, before handover).
- **Clauses 4–10 are not excludable; Annex A controls are, with justification in the SoA.** The misreading "you must implement all 93" is false; so is "pick from Annex A."
- **The four dispositions map one-to-one, with three precision notes.** mitigate = *modification*; accept = *retention* (a treatment option, defined as "temporary") and *acceptance* (the decision act — "Accepted risks are subject to monitoring and review"); transfer = *sharing* ("Risk transfer is a form of risk sharing," and sharing still "requires at least one control" whose implementation is delegated); avoid = *avoidance* — the only disposition that can shrink scope. "Taking risk to pursue an opportunity" is excluded for information security.
- **Tolerances are ISO's "risk acceptance criteria."** 27005 §6.4.2 wants: an approver level per threshold; time-boxed exceptions above threshold with a committed plan; class exceptions (legal risks "not always retained"; contractual acceptances allowed); independent consideration of consequence and likelihood ("a simple yes/no does not always suffice") — i.e., a catastrophic-consequence veto; and explicit protection against **over-control**: "having so many information security controls that they prevent the ability of the organization to achieve its objectives." Approved "by the authorized management level."
- **Every field of a decision record has a clause.** Owner with authority (§7.2.2); tolerance cited (§8.6.2); override "explicitly comment … and include a justification" (§8.6.3); conditions and time (§8.6.3); rationale "recommended" (§10.4.3); review of accepted risks "separately, and … as an aggregate" (§10.5.2). This is the author's "an accepted risk is a decision, not a shelf," with citations.
- **Residual is conditional on control health.** "Controls may not always exert the intended or assumed modifying effect" (3.1.16); likelihood is reassessed when "vulnerabilities are discovered in implemented controls" or "control effectiveness tests … result in unexpected outcomes" (§7.3.3). The author's "a mitigated risk resting on failing controls is quietly back to inherent," in ISO's words.
- **Vulnerability.** ISO's definition is *potential* ("can be exploited"); 27002 files vulnerabilities under *event reporting*. ISO sets no SLA — 8.8 asks for "a timeline to react" defined by the organization, and warns that scanners "can therefore produce false positives" and that composite countermeasures mask component weaknesses (the Swiss-cheese point). The crosswalk imports ISO "vulnerability" as program `finding` until `exploitable` is determined.
- **Event-based vs asset-based.** 27001 "does not mandate a particular approach." The harm sentence is an event-based strategic scenario; inventory supplies the asset-based drill-down. The register should be event-based at the row, asset-linked beneath — which is what the program already does.
- **Proportionality, in ISO's text.** Rough estimates "can be sufficient"; roles can be additional duties; segregation of duties compensated when small; "over-classification … results in additional expense"; schedule assessments to budget cycles. ISO is not the heavyweight; over-reading it is.

The rule, restated: **"ISO 27001 is a certifiable, risk-based management system. Procedural means documented and practiced — a policy only maintains risk; practice modifies it. The certificate rests on records of things having happened. The SoA is a view of your risk decisions, never a shopping list."**

### 1.2 PCI — sharper than Addendum A in two places

- **Scope has three buckets, and the third is the author's "security-impacting" set, named by PCI.** CDE = (a) components, people and processes that store/process/transmit CHD or SAD; (b) anything with unrestricted connectivity to them; (c) anything that "could impact the security" of CHD — authentication servers, SIEM, MFA, anti-malware, segmentation systems, DNS, "tools, code repositories, and systems that implement software configuration management or for deployment of objects to the CDE." "The primary account number (PAN) is the defining factor." No PAN still leaves 12.8 (TPSPs), 12.10 (incident response — "applicable to all entities"), own-page scripts (6.4.3/11.6.1) and SAD-never-stored. Scope is confirmed and justified annually (12.5.2), out-of-scope networks are *untrusted*, segmentation is "not a PCI DSS requirement" but the only way to shrink scope, and "encryption alone is generally insufficient" to de-scope.
- **It is a contractual standard, not law or certification.** "Whether any entity is required to comply with or validate their compliance to PCI DSS is at the discretion of those organizations that manage compliance programs (such as payment brands and acquirers)." Results are "in place / not in place" — never pass, fail or certified. Levels and SAQ types live in brand rules and the SAQ instructions, not in the standard.
- **Risk enters at hinges, not everywhere.** The Targeted Risk Analysis (12.3.1) for nine frequency-flexible requirements; the 6.3.1 vulnerability ranking that drives 6.3.3, 11.3.1 and 11.4.4; compensating controls (App. B/C, only with "legitimate and documented technological or business constraints"); the customized approach (App. D, for "risk-mature entities," barred to SAQ filers). An enterprise risk assessment is "recommended, but is not required." Acceptance is permitted **only inside the latitude a requirement grants**; "requirements are not considered to be in place if controls are not yet implemented or are scheduled to be completed at a future date."
- **Vulnerability vs finding — PCI agrees on the definition and is stricter on scans.** Glossary: "Flaw or weakness which, **if exploited**, may result in … compromise." 11.4 separates "exploitable vulnerabilities and security weaknesses." But every scanner item must carry a 6.3.1 rank regardless of exploitability; high/critical must be *resolved* (11.3.1); externally, CVSS ≥ 4.0 after significant change must be resolved (11.3.2.1); lower ranks "addressed based on the risk defined in the entity's targeted risk analysis" (11.3.1.1). The verbs are resolved/addressed/corrected, never accepted. **Reconciliation:** the program keeps `finding` and `vulnerability`, but inside a CDE a `finding` label never suppresses the 6.3.1 ranking record, and the exploitable/high/critical set is hard-remediated while lower ranks are dispositioned under the TRA — which is a tolerance.
- **KMO v1.0 does not apply to a typical SaaS or small merchant.** It is a program standard for PIN/P2PE key-management service types (KIF, HaaS, CA/RA, signing, PIN processing, decryption management), assessed only by KMO-qualified assessors, with no customized approach and no compensating controls. A SaaS company's key duties remain PCI DSS 3.6/3.7 and 12.3.3; if it consumes a cloud HSM, KMO is at most the provider's standard. The module needs a one-screen "does KMO apply?" test.

### 1.3 SOC 2 — rule 1 made precise and fair

- **An attestation under AT-C 205.** Management describes the system (DC 200), states service commitments, identifies the controls per criterion, operates them, retains evidence, and signs an assertion; the auditor obtains "sufficient appropriate evidence … in accordance with AT-C section 205" and opines. SOC 2+ is the clinching text: management may add subject matter and *define the criteria*; the auditor checks only suitability. No certification exists; "we passed" has no referent; the deliverable is a report with an opinion, restricted-use.
- **The auditor's say, fairly.** True: criteria never name a tool, frequency or vendor; points of focus "do not require an assessment of whether each … is addressed"; independence bars designing management's controls; the firm's peer review is the operative constraint on what it will accept. Also true, and the module must say it: the auditor holds legitimate judgment on four questions — is the description fairly presented; does the control *as designed* address the criterion so the commitment is achieved; did it operate across the period; is the evidence sufficient. The auditor cannot pick the control, require a tool, require a frequency never promised, or treat a platform template as baseline. Neither party can compel the other's design; the recourse is redesign, accept an exception, accept a qualified opinion, or change firms.
- **Risk is first-class (CC3, CC5.1, CC9), method-agnostic.** CC3.1 clear objectives = tolerances; CC3.2 "analyzes risks as a basis for determining how the risks should be managed" = a decision is required, the vocabulary is not; CC3.3 fraud = a fraud branch; CC3.4 change = the `premise-moved` sensor; CC5.1 "to acceptable levels" presumes a stated tolerance; CC9.2 vendors. Accepting a risk is fully permitted.
- **Every description sentence is a test script.** "All critical and high vulnerabilities remediated within 30 days," with "critical" meaning scanner severity, is over-commitment and routinely excepted. SOC 2 does not define "vulnerability" or mandate an SLA; the organization's taxonomy — exploitable → SLA; else finding routed by signal — *is the control under test*, and tighter is more defensible.
- **Copyright.** The TSC and DC are AICPA property; the module carries criterion ids and program-authored short titles, never criterion text or points of focus.

### 1.4 NIST CSF 2.0 — public domain, and SP 1353 speaks to this harness

- Voluntary outcomes guidance; no assessor, no "compliant." 6 Functions, 22 Categories, 106 Subcategories; Implementation Examples are "not a baseline." Tiers characterize rigor and are not maturity levels; the module **never stores a Tier** — it compiles an *indicative* characterization from program facts and labels it so.
- GOVERN maps to program steering almost line by line: GV.OC-03 = the obligations register; GV.RM-02 = appetite + tolerances; GV.RM-04 = the four dispositions; GV.RM-06 = the program's method itself; GV.RR-03 = declared capacity; GV.PO = policies with review dates and acknowledgments; GV.SC = the vendor silo. **ID.RA-06 is the decision record.**
- SP 1353 ipd (Using AI for CSF Analysis and Reporting, Aug 2026) is directly about what this harness does. Where it already aligns: "use only the attached source materials"; "if an outcome is not addressed in the sources, say so plainly"; human review before use. Where it changes the design (adopted in §6): mapping status and provenance on every crosswalk row; a pinned Core version; a deterministic id-exists check; `basis: documented | observed` on current-practice claims; a mandatory "Assumptions & Evidence Gaps" trailer; a per-category GOVERN alignment view (Aligned / Partial / Misaligned / Not addressed); and a reminder that a compiled profile is "not a prescriptive assessment or assurance methodology."
- NIST works are U.S. Government works: the module may carry the **full Core text** and the quick-start guides, with attribution.

---

## 2. Module structure (public core)

```
compliance/
  PROFILE-SCHEMA.md                 # the 12-question shape every profile answers (see §3)
  profiles/
    soc2/   pci-dss/   iso-27001/   nist-csf-2/      # v1 set; each directory holds:
      profile.md        # the 12 sections: kind · scope · structure · requires/does-not · risk · flexibility ·
                        #   assessment mechanics · vocabulary · pragmatism · hooks · key refs · gaps
      structure.yaml    # identifiers and hierarchy as data: ids, groupings, counts, flags
                        #   (PCI: SP-only, TRA-triggering, customized-ineligible, Table 4 timeframes;
                        #    ISO: 93 ids, 4 themes, 5 attributes + hashtags, CLD ids with edition tag;
                        #    TSC: CC1–CC9/A/PI/C/P ids; CSF: full Core text — public domain)
      scope-rules.md    # how applicability is derived from INVENTORY (PAN in data stores/flows → CDE buckets;
                        #   ISMS scope from systems/sites/people groups + interfaces; SOC 2 boundary + carve-outs;
                        #   CSF org profile scope)
      vocabulary.yaml   # framework term → definition ref (id/page, not text where licensed) → program term
                        #   (ISO "vulnerability" → finding-until-exploitable; PCI "requirement" ≠ control; TSC "criterion" ≠ control)
      compile/*.md      # recipes: program objects → framework artifact (see §5)
      sensors.yaml      # framework-justified deterministic checks (see §6)
      questions.md      # the question bank the advisor is tuned for, each with its expected citation shape
      sources.yaml      # texts needed; license class; pinned edition/version + hash; where the user's copy lives
  crosswalks/
    <fw>-<fw>.yaml      # rows carry mapping_status ∈ {proposed, derived, validated}, mapped_by, validated_by/at, source_context
  obligations/          # Addendum A: schema, Why-gate template, dispositions, anti-patterns, refusals
  advisor/
    persona.md          # `compliance-advisor` (§4) — full + compact, OpenDeshi format
    skill.md            # answer contract, refusal rules, citation format, logging
  steering/             # the compliance doctrine set (Addendum A's list, revised per §1)
```

**Three license classes**, declared per source in `sources.yaml` and enforced by the engine:

| Class | Examples | What the module carries | What the user supplies |
| --- | --- | --- | --- |
| `public-domain` | NIST CSF 2.0 Core, SP 1300/1301/1303/1305/1353, SP 800-53 | Full text, attributed | nothing |
| `free-copyrighted` | PCI DSS v4.0.1, PCI KMO, PCI supplements | ids, section titles, timeframes as data, short attributed quotes with page; links to the PCI SSC library | their downloaded copy for full text (indexed locally, never committed) |
| `licensed-purchase` | ISO/IEC 27001, 27002, 27005, 27017; AICPA TSC/DC | ids, structure, attribute hashtags, clause numbers; **program-authored paraphrase titles** | their licensed copy (indexed locally, never committed); the advisor opens it at a page |

`rbc sources add --framework iso-27001 ~/standards/ISO-IEC-27001-2022.pdf` hashes, pins the edition, indexes locally under a gitignored path, and records the fact (not the text) in `rbc.config.yaml`. A sensor refuses a commit that contains licensed text.

---

## 3. The profile schema (uniform across frameworks)

Every profile answers the same twelve questions, in order; this is what makes the advisor's answers comparable and lets a new framework be added as a repeatable task:

1. What kind of thing it is (attestation / certification / contractual standard / regulation / voluntary guidance), who issues, who assesses, who can "fail" you and on what authority, the framework's own vocabulary for itself.
2. Who it applies to and what triggers scope; what is excludable and how exclusions are justified.
3. How the document is structured; normative vs informative; counts.
4. What it actually requires — and what it does not; common misreadings refuted against the text; where design is left to the organization.
5. How risk appears; what must be documented about risk decisions; whether acceptance is permitted and how it is recorded.
6. Flexibility points (customized approach, compensating controls, SoA exclusions, management-defined criteria, tiers/profiles) and the evidence each demands.
7. Assessment and evidence mechanics (Type 1/2; Stage 1/2, surveillance; ROC/SAQ/AOC; sampling; what "operating" or "in place" means; report consumers).
8. Vocabulary that must be used precisely.
9. Where a 50–500-person company's pragmatism applies — do-first order, traps, proportionality in the text.
10. Hooks for AI-RBCDLC — program objects → framework parts; artifacts compiled as views; carry vs. user's copy.
11. Key quotes with refs (short; license-class aware).
12. Open questions and gaps in the sources on hand.

The four v1 profiles exist in draft (`_study/frameworks/fw-*.md`, 6–10k words each). Trimmed, license-cleaned versions become `profile.md`; the quote-heavy drafts stay private.

---

## 4. The Compliance Advisor

A persona in the roster (OpenDeshi format; mandatory cross-domain reviewer is `business-owner`), bound to a skill with a fixed **answer contract**:

1. **Name the framework and its kind** in the first line ("PCI DSS v4.0.1 — a contractual standard enforced by brands and acquirers, not a law").
2. **Run the scope test against inventory** before anything else ("your data stores show no PAN; your payment flow is a hosted redirect; the live PCI duties are 12.8, 12.10 and your own page scripts").
3. **Cite** — framework, id, page/clause — for every factual claim; quote only within license class; otherwise "see your copy at p.NN."
4. **Say what the text does and does not require**, using the misreadings table; never "you must" unless the text says shall/must and the scope test says it applies.
5. **State the program consequence**: which obligation to record, which disposition options exist, which controls already cover it (crosswalk, with mapping status), which artifact compiles.
6. **"Not addressed in the sources" is a valid answer**; so is "this is auditor preference, not a criterion."
7. **Log the answer** as an `advice` record in the intent's audit shard (question, sources cited, answer hash) — advice is attributable and reviewable, never ephemeral.

Refusals: no rendering of licensed text; no "compliant / certified / passed" vocabulary where the framework has none; no Tier or maturity score presented as a result; no control designed *from* a criterion (route to the Control Compiler with the harm/obligation first); no answer that names a tool as required by a framework.

The question bank it is tuned for (per profile `questions.md`), by type: *applicability* ("does X apply to us?"), *demand-testing* ("do we need a pentest for SOC 2?"), *text lookup* ("what does ISO say about…"), *production* ("what do we have to produce for a Stage 1?"), *coverage* ("which controls cover CC7.1?"), *gap* ("what's between us and an unmodified Type 2?"), *auditor-boundary* ("can the auditor make us…?"), *capacity* ("should we pursue ISO this year?" — answered with the practiced-clauses list and declared capacity, as a disposition recommendation to the business owner, never a yes).

---

## 5. Compile recipes — framework artifacts as views of the program

The design principle from the profiles: every framework's heavyweight document is a *projection* of objects the program already maintains. The module ships recipes; the engine renders them into `rbc/views/<fw>/`; nothing is hand-maintained.

| Framework | Artifact | Compiled from |
| --- | --- | --- |
| **ISO 27001** | Statement of Applicability | per Annex A / CLD id: necessary? (any decision links a control crosswalked to it) · justification (blanket sentence allowed by 27005 §8.5, or the linked harm) · implementation status from control health · exclusion justification where no decision needs it |
| | Risk assessment results; risk treatment plan(s); residual-acceptance record | `risks/` × `decisions/` × `controls/implementation` × `tasks/` — the §10.4.3 documented-information list, item by item |
| | Scope statement (4.3); context & interested parties (4.1/4.2); risk criteria (6.1.2 a) | inventory + interfaces to out-of-scope services; `steering/company.md` + `obligations/`; `tolerances/` + method steering |
| | Roles (5.3), policy index with the seven §5.1 elements, external-agreements register (5.20), legal/contractual register (5.31), shared-responsibility matrix per cloud vendor (CLD.5.38), assessment schedule & performance, management-review pack, nonconformity log | `steering/roles.md`; `policies/`; `vendors/`; `obligations/`; `tasks/` runs; 6.3 outputs; findings with `kind: nonconformity` |
| **PCI DSS** | Scope statement / annual confirmation (12.5.2) | flows by stage and channel; components flagged CDE / connected / security-impacting / out-of-scope-with-justification; segmentation controls; third-party connections; dated approval |
| | Network and data-flow "diagrams" (1.2.3/1.2.4 — "other technical or topological solution … can be used") | generated graphs from `systems/` + connections + `data-stores/` flows |
| | Component inventory (12.5.1); TPSP list (12.8.1) + responsibility matrix (12.8.5); TRA documents (12.3.1) in PCI SSC template layout; compensating-control worksheets (App. C); policy coverage index (`X.1.1`); timeframe calendar (Table 4) with missed-activity records; pre-filled SAQ/ROC working papers | `systems/`; `vendors/` × `obligations/`; `tolerances/` (a TRA *is* a tolerance with the five 12.3.1 elements); `decisions/`; `policies/`; `tasks/` |
| **SOC 2** | System description DC 200.A–I | A/B from `obligations/` (service commitments are quoted contractual promises); C/D from inventory; E from `controls/library` × TSC ids; F CUECs from customer obligations; G subservice organizations from `vendors/` with `subservice: carve-out \| inclusive \| none`; H from inventory-sync and decision history; I from incident findings |
| | Control matrix (criterion × control × evidence × frequency × owner); risk assessment to CC3/CC5/CC9; CUEC list; subservice list with CSOCs; policy set; evidence index by period; management's assertion *draft* (signed by management, never by the program); bridge-letter draft | `controls/`, `evidence/`, `risks/`, `decisions/`, `tolerances/`, `vendors/`, `policies/`, post-period decision history |
| **NIST CSF 2.0** | Organizational Profile (Current + Target) per SP 1301 template; gap analysis; action plan; GOVERN alignment view; indicative Tier characterization (labeled as such) | pinned Core + `controls/` (practices tagged `basis: documented \| observed`) + `controls/implementation.coverage` → Status + `maturity-targets.yaml` → Goals + `risks/`/`obligations/` → Priority; `tasks/` + Mitigate rows → action plan; always ending with "Assumptions & Evidence Gaps" |

What **cannot** be compiled, and the module says so: ISO's practiced clauses (internal audit 9.2, management review 9.3, competence/awareness 7.2–7.3, continuity exercises, incident drills, scheduled assessments) — these are records of things having happened; the module schedules, templates and stores them, never generates them. PCI's ROC/SAQ/AOC are official PCI SSC forms — the module produces the input, never a substitute form. SOC 2's assertion is management's signature.

---

## 6. Sensors the frameworks justify (consolidated)

| Sensor | Basis |
| --- | --- |
| `control-has-risk` — a control (or SoA entry) with no linking decision is a finding about the catalogue | 27005 §8.5; TSC CC5.1; program doctrine |
| `crosswalk-direction` — rows run control → criterion; a criterion with no control is a *visible gap*, never a mandate | 27005 §8.4; TSC ¶.03; Addendum A |
| `mapping-status` — every crosswalk row carries `proposed \| derived \| validated` + provenance; unvalidated rows excluded from audit packages | SP 1353 ipd p.7–8 |
| `fw-id-exists` — any framework id not in the pinned `structure.yaml` is rejected (the cheapest hallucination check) | SP 1353 ipd p.8 |
| `source-pinned` — compiled views name the framework edition/version and hash; warn when stale | SP 1353 ipd p.7 |
| `licensed-text-not-committed` — refuses commits containing text from `licensed-purchase` sources | ISO licence terms; 27002 §5.32 l) |
| `pci-scope-vs-chd` — PCI obligations ⇄ PAN/SAD presence in `data-stores/` and flows, both directions; `security-impacting` bucket populated from `systems/` | PCI DSS p.4–10, 12.5.2 |
| `pci-rank-never-suppressed` — inside a CDE, every scanner item carries a 6.3.1 rank regardless of `kind`; high/critical and CVSS ≥ 4.0 external are not dispositioned by acceptance | PCI 6.3.1, 11.3.1, 11.3.2.1 |
| `pci-timeframe-window` — quarterly = 90–92 days, annual = 365/366; late activity requires a documented detect/catch-up record | PCI p.25–27 |
| `finding-vs-vulnerability-import` — ISO/SOC 2/PCI "vulnerability" imports as `finding` with `exploitable: undetermined`; SLA permitted only on `kind: vulnerability ∧ exploitable: true` (PCI numeric gates override inside a CDE) | 27002 §8.8; 27005 A.2.5.3; TSC CC7.1; PCI reconciliation |
| `accepted-above-threshold-has-plan-and-expiry`; `override-has-justification`; `risk-has-owner-with-authority` | 27005 §6.4.2 f), §8.6.3, §7.2.2 |
| `residual-recomputed-from-control-health` | 27005 3.1.16, §8.3, §10.7; program doctrine |
| `procedure-is-practiced` — any §5.37-triggered procedure, drill or review has a run record within its frequency | 27002 §5.37, §6.3, §5.30; "documentation as security" anti-pattern |
| `policy-has-seven-elements`; `policy-acknowledged`; `policy-review-date` | 27002 §5.1; PCI 12.1.1–12.1.3; TSC CC1/CC2/CC5.3; GV.PO |
| `control-promise-tested` — every control sentence has frequency, role, evidence ref | SOC 2 "every description sentence is a test script" |
| `description-vs-controls`; `period-coverage`; `cuec-disclosed`; `category-vs-obligation` | DC 200; Type 2 mechanics |
| `shared-responsibility-declared` — per cloud vendor before provider-side controls are authored | 27017 CLD.5.38; 27002 §5.23 |
| `capacity-exceeded` — recurring cost of accepted obligations vs `steering/roles.md` | GV.RR-03; 27005 §6.4.1 "capacity"; Addendum A |
| `no-compliance-vocabulary-misuse` — advisor and views never emit "certified/passed/compliant" where the framework has no such state | profiles §1/§8 |

---

## 7. Stages, scopes, personas — changes to fold into v0.3

- **GOVERN 1.5 obligations-intake** (from Addendum A) is where every framework enters; it now consults `scope-rules.md` so applicability is derived from inventory at the door.
- **CONTROL 4.5 framework-crosswalk** carries `mapping_status`/provenance; validation by `assurance`; the direction rule is a sensor.
- **ASSURE 6.4 audit-package** becomes framework-specific via compile recipes (§5); a new **6.5 framework-readiness** stage prices the *practiced* clauses and the gap against declared capacity and returns a disposition recommendation to the business owner (satisfy / defer / decline / transfer) — this is how "should we pursue ISO?" gets an honest answer.
- **Scopes:** `compliance-advisory` (a question → a logged, cited answer; no other artifacts), `framework-readiness` (1.5 → 4.5 → 6.5), `obligation` (1.5 → Why gate → 2.5 decide), `audit-prep` now begins at 1.5 and ends with the framework's compiled package.
- **Personas:** `compliance-advisor` added (adversarial reviewer: `business-owner`; mandatory pair unchanged); `assurance` gains crosswalk validation; a `finding-triage` skill attaches to `assurance` and `risk-assessor`.
- **Composer routing:** any request naming a framework, auditor, platform, questionnaire or "for compliance" → `compliance-advisory` first (answer the question), then `obligation` if an ask survives the Why gate.

---

## 8. Sources, licensing and what stays private

- The four profile drafts (`_study/frameworks/fw-iso.md`, `fw-pci.md`, `fw-soc2.md`, `fw-nist-csf.md`) quote texts for the author's verification. They are **study notes**, kept in the private folder, never core content. 
- Shipped `profile.md` files are rewritten in the author's words, with quotes only from `public-domain` sources and short attributed excerpts from `free-copyrighted` ones.
- **Gaps in the source set** the module should close before v1: ISO/IEC 27001:2022 itself (clause wording for 4–10, the 6.3 "planning of changes" addition, and the clause-10 numbering — 27005 maps corrective action to "10.1" where the published standard likely says 10.2); the AICPA TSC and DC 200 texts (CC9.2 unread; counts); PCI's ROC Template result categories (In Place with Remediation / N/A / Not Tested), SAQ instructions and eligibility, ASV Program Guide; ISO/IEC 27006 and 17021-1 for certification mechanics; a published (not DIS) 27017 when it lands.
- **Counsel question:** whether to carry ISO Annex A and TSC *short titles* in the open module. The conservative design — ids plus program-authored paraphrases, with the user's licensed copy supplying titles and text — is adopted until answered.

---

## 9. Build sequence (replaces M3's compliance slice in plan v0.2)

| Milestone | Delivers |
| --- | --- |
| **M2.5 — Module skeleton + CSF** (wk 6) | `compliance/` layout; PROFILE-SCHEMA; `nist-csf-2` profile with full public-domain Core as `structure.yaml`; pinned-version and `fw-id-exists` sensors; crosswalk schema with `mapping_status`; the Organizational Profile compile recipe; `compliance-advisor` persona and answer contract; `compliance-advisory` scope. |
| **M3 — SOC 2 + PCI + obligations** (wk 7–9) | `soc2` and `pci-dss` profiles (ids/titles/structure as data; license-classed quotes); scope-rules from inventory (CDE buckets; system boundary + carve-outs); compile recipes (DC 200 description, control matrix, CUECs; PCI scope statement, diagrams-as-data, TRA-as-tolerance, timeframe calendar); the KMO applicability test; obligations pipeline and Why gate wired to 1.5; `obligation` and `audit-prep` scopes. |
| **M4 — ISO + readiness** (wk 10–12) | `iso-27001` profile and structure (ids, themes, attributes, CLD with edition tag); `rbc sources add` for licensed texts with local indexing and the commit guard; SoA / treatment-plan / documented-information compile recipes; the practiced-clauses list and 6.5 framework-readiness; `framework-readiness` scope; ISO vocabulary bridge (vulnerability → finding; retention/acceptance/sharing). |
| **M5+** | Additional profiles by the 12-question schema, in demand order: CIS Controls v8, HIPAA Security Rule, ISO/IEC 27701, NY DFS Part 500, GDPR/CCPA posture, NIST SP 800-171/CMMC, SOC 1 (as a boundary note), DORA/NIS2. Each is a contributable unit; the schema and sensors make quality uniform. |

---

## 10. Decisions

| # | Decision | Status |
| --- | --- | --- |
| B1 | A dedicated compliance module (profiles · advisor · compile recipes · obligations), not a steering set alone | Proposed — the deep read makes the case |
| B2 | Three license classes enforced by the engine; licensed texts indexed locally, never committed; ids-plus-paraphrase for ISO/TSC titles pending counsel | Proposed |
| B3 | Ship NIST Core and QSGs in full (public domain) | Proposed |
| B4 | Rule 3 restated per §1.1 | Proposed — needs the author's sign-off on wording |
| B5 | Advisor answers are logged, attributable records | Proposed |
| B6 | v1 profile set = SOC 2, PCI DSS, ISO 27001, NIST CSF 2.0; order of the M5+ set | Open |
| B7 | Acquire ISO/IEC 27001:2022 and the AICPA TSC/DC texts before encoding clause/criterion keys | Recommended |

## What this is not

Not a GRC catalogue; not a substitute for the organization's licensed standards; not an assessor (it never issues "in place," a certificate, or an opinion); not a maturity scorer; not a template library that becomes the program by inertia.
