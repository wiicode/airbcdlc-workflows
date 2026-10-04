<!-- scope: steering · method · THE SOURCE DOCTRINE (the author's field guide, verbatim). Loaded as the method's quality bar; apply, don't recite. -->
Risk-Based Management for IT and Information Security
A field guide for startup-to-growth companies
How a company of 50 to 500 people, with hands-on engineering teams and a fast release cadence, can run security as a set of governed risk decisions instead of a queue of findings — using NIST CSF 2.0 as the frame, without building a GRC department.

1. The problem this guide solves
Most growing technology companies arrive at security through compliance. A customer asks for a SOC 2 report or an ISO 27001 certificate; a compliance platform is bought; a control catalogue is adopted from the framework; evidence is collected; an auditor signs. This is a reasonable path, and it produces something real. It also produces a specific blind spot.
The blind spot is that risk management starts at the wrong end. A scanner fires, a penetration test lands, an auditor raises an exception, a customer asks a hard question. A "risk" is written from that finding. A fix is assigned. Where no fix is possible, someone proposes monitoring. The register fills with rows that are really tickets, every row demands a remediation plan, and the only way a row can close is "mitigated." Nothing ever enters from the leadership question what are we willing to carry, and what are we not? The company feels reactive because it is reactive by design.
The cycle actually being run looks like this:
Compliance catalogue / best practice / advice
  → deploy safeguards (Protect)
  → monitor, scan, alert (Detect, treated as the control)
  → a failure or vulnerability appears
  → write a risk from the finding
  → catalogue it; the owner must mitigate
The corrected cycle, which this guide describes how to run at small scale, is the one NIST CSF 2.0 draws:
GOVERN → IDENTIFY → PROTECT → DETECT → RESPOND → RECOVER
   ▲                                                  │
   └──────────── monitor, evaluate, adjust ───────────┘
The difference is where the risk decision lives. In the first cycle it never happens; mitigation is assumed. In the second, the decision — mitigate, accept, avoid, or transfer — is an explicit output of Govern and Identify, made by the person who owns the harm, recorded, and reviewed. Everything else in this guide is machinery for making that decision cheap enough to make every time.

2. The model in one page
2.1 Six activity points
NIST SP 1303, the CSF 2.0 enterprise-risk quick-start guide, lays out six activity points. They translate directly to what a small company does.
Point
CSF Function
What happens
Plain translation
1
Govern
Mission, priorities, risk appetite; accountability assigned
Who owns risk; what the company will not accept
2
Govern / Identify
Appetite → tolerance → requirements
The one-sentence tolerance statements everything is compared against
3
Protect · Detect · Respond · Recover
Controls selected to reach acceptable risk
The control catalogue; detection sized to the risks being carried
4
Identify / Govern
Response and residual risk recorded in the register
The register row with owner, date, and disposition
5–6
Govern
Aggregate, report, adjust strategy
Quarterly review; feedback can change tolerance, not only controls

The decision happens at point 4. Points 1 and 2 are what make it possible. Point 3 is where most companies spend all their time, and point 4 is where they spend none.
2.2 Four responses, all terminal
A risk is treated by exactly one of four responses. Each is a legitimate end state.
Response
Means
What gets recorded
Mitigate
Reduce likelihood or impact with a control
The control, a link to the work, the residual risk
Accept
Carry the risk within appetite
Owner, rationale, date, review trigger; residual equals inherent
Avoid
Stop, or do not start, the activity that carries the risk
What stopped and what replaced it
Transfer
Shift the consequence: contract terms, insurance, partner obligations
The instrument, the counterparty, what is not transferred

A register that can only close a row as "mitigated" will structurally drive the company toward controlling everything, and informal acceptances — which happen daily in any real organization — will have nowhere to be written down. That is the single most common register design flaw.
2.3 Where Detect sits
The Detect function exists to find compromises and attacks that have already occurred. It confirms that Protect did not hold. It is a capability the company sizes to the risks it has decided to carry; it is not itself the risk decision, and it does not reduce likelihood. Monitoring proposed as the response to a risk is the most frequent way the corrected cycle collapses back into the first one.
A distinction worth keeping sharp: passive detection (an alert, a log search, a dashboard) changes nothing about likelihood. Detection with response authority (a managed detection-and-response service that can isolate a host and kill a process) is a genuine mitigation on the branch it covers, because it shortens the window and contains impact. Both can be right. The failure is adopting either one instead of deciding the parent risk.

3. Vocabulary that does the work
Most register problems are vocabulary problems. These definitions are deliberately strict.
Harm. A consequence to something the company cares about: customers, revenue, data, reputation, legal standing, the ability to operate. A harm is always to the company or its customers; it is never a tool, a system, or a behavior.
Risk. A harm plus the standing condition that makes it possible, written as one sentence: [who] suffers [what] because [standing condition]. If it cannot be written that way, it is not a risk.
Mechanism. The standing condition. Usually a design choice or policy the company has made, often implicitly: "contractors work from personal devices," "developers authenticate to source control with long-lived tokens," "the support tool has full access to every customer endpoint." Mechanisms are rarely wrong in themselves; they are the thing every branch hangs from.
Branch. One distinct way the mechanism produces the harm. Branches are separate when they take different responses. Three to six per parent is typical. One of them is usually a governance gap.
Finding. Evidence that a control is not holding: a scanner result, a penetration-test item, an audit exception, a vendor advisory. A finding is input to a risk assessment. It is never a risk, and it never belongs in the register as a row.
Control. Something the company does, on purpose, to reduce the likelihood or impact of a harm. A control has an owner, an implementation state, and a written statement of the risks it treats.
Control gap. A control that exists in the catalogue but is unimplemented, parked, or not enforced. Not a risk; the risk is the harm the control was meant to prevent.
Governance gap. A risk with no owner, no tolerance to compare against, or no recorded decision. It usually sits underneath several branches as the reason none of them has been decided.
Tolerance. One sentence, written by leadership, stating how much of a specific exposure the company will carry: "The company will not carry X beyond Y." Every risk's residual is compared to one of these.
Residual. What remains after the response. For Accept, it equals the inherent risk. For a parent risk, it is the sum of residuals on the branches.

4. Three objects, two links
A working program needs exactly three kinds of record and two relationships between them.
   RISK  ──treated by──▶  CONTROL  ◀──tests──  FINDING
 (register)              (catalogue)          (ticket queue)
A risk links to the control or controls that treat it.
A finding links to the control it tests.
Controls are the spine. They are the one object every growing company already has, because a compliance framework handed them over.
The two most common structural errors are merging finding and risk into one record (so the risk closes when the ticket closes and the decision is never made) and keeping risks and controls in separate systems with no link between them (so the register reinvents, badly, what the catalogue already says).
The fix for both is the same: make the control link a required field on every risk and every finding. A risk with no control link is returned to its author. A control with no risk attached is itself a finding — about the catalogue.

5. Where to start: the catalogue already in hand
The question "where do we even begin?" has an answer most companies overlook. Begin with the control catalogue the compliance framework already provided.
5.1 Turn a compliance catalogue into a risk-based one
For every control, write one field: Risk — the harm or harms this control exists to prevent, in the sentence form above, with whatever evidence exists (an incident, a near miss, a customer question, an industry precedent). This single act converts a checklist into a risk catalogue. It takes a few hours per twenty controls and is best done by the people who operate the controls, not by a compliance function.
Add three more fields if they are not there: Implementation % (an honest number), Coverage (a simple status: active and on track, planned, parked, blocked, at risk), and Framework mapping (which CSF Function and category the control serves). These make prioritization possible without any scoring matrix.
5.2 The first register is a view of the catalogue
Once the Risk field exists, the first register writes itself: one row per distinct harm, linked to the controls that treat it, prioritized by implementation gap. Lowest implementation percentage first. A company with 100 to 150 controls will typically find 40 to 60 distinct harms, which is a tractable number to put in front of leadership.
5.3 Add scenarios as evidence
A short table of threat scenarios — a sentence of narrative each, rated on a four-word likelihood scale (precedent, probable, plausible, remote) and linked to the controls they stress — gives the register its evidence base. Fifteen to twenty-five scenarios cover most growth companies. Draw them from incidents the company has actually had, incidents in the industry, and the questions customers and auditors keep asking.

6. The breakdown: the only analysis the program needs
Every item — a one-line concern, a finding, a vendor advisory, a proposed tool, a leadership question — goes through the same method. It takes about twenty minutes once practiced. There is no scoring matrix, no heat map, no quantitative model; those can be added later if the company grows into them, but they are not what is missing at this stage.
6.1 Steps
Classify the input. What is it, actually? A harm, a mechanism, a threat branch, a finding, a control gap, a governance gap, or someone's proposed response. Strip the tool name and the verb. "Misuse of the remote-support tool" is not a risk; the harm behind it is customers being damaged because an unmanaged device had privileged access.


Place it in the cycle. Which CSF Function did it enter at, and which should it have started at? Most inputs arrive at Detect or Respond and should have started at Govern or Identify. Saying so, once, is often the whole correction.


Name the parent risk. One sentence: [who] suffers [what] because [mechanism]. Consequence to the company. Severity on four words: catastrophic, major, moderate, minor.


Name the mechanism. The standing condition every branch hangs from.


Enumerate branches. Each distinct path from mechanism to harm. Rate likelihood from evidence (precedent, probable, plausible, remote), not from adjectives. Expect one branch to be the governance gap underneath the rest.


Choose one response per branch. Avoid, mitigate, accept, or transfer. A branch that wants two responses is two branches, or one branch with a primary response and a named fallback ("avoid; if refused on cost, mitigate with X and record the residual"). Never a slash. The register will only ever hold one decision per row, and "mitigate / accept" is how undeclared acceptances hide.


Join each branch to the catalogue. Which control owns it, at what implementation state. If no control owns a branch, that is a finding about the catalogue.


Map each response to the framework. The CSF subcategory the response lands in. The recorded decision itself is always ID.RA-06 (risk responses chosen, prioritized, planned, tracked, communicated).


Check against tolerance. Which tolerance statement does the parent compare to? If none exists, write a draft and flag it as the missing governance input.


Place any proposal. If someone proposed a fix, an alert, a tool, or a data pull, put it on the tree: which branch, which half of the branch (before or after compromise), which Function. The placement is the argument; no editorial is needed.


Write the guidance. Three moves at most, each with an owner. Guidance is about where the conversation needs to go next, not a project plan.


6.2 A worked example
Input: a register row titled "Misuse or unauthorized access to the remote-support tool."
Classification: a tool-named risk. It describes a control failing, and it points at the least likely path — the tool itself is MFA-protected. Underneath it: a mechanism and a governance gap.
Parent risk: customers suffer an outage, data exposure, or fraud originating in the company's support channel, because third-party support contractors on unmanaged personal devices hold privileged access to customer endpoints. Consequence: reputational, legal, financial. Severity: catastrophic.
Mechanism: privileged fleet access granted to contractors working from devices the company cannot see or attest.
Branch
Evidence
Likelihood
Response
Framework placement
(a) Contractor device infected; credentials, screenshots, session data leak out
Prior incident: credential-stealing malware on a contractor's personal laptop
Precedent
Avoid — no unmanaged devices for privileged support roles; issued device or managed virtual desktop. Fallback: mitigate with a contractual device standard and endpoint protection attestation
GV.SC-05, PR.AA-03, PR.DS-10
(b) Infected device rides the already-authenticated support session into the fleet
Same device population; vendor advisory on the tool's file-transfer feature
Probable
Mitigate — disable the risky feature until patched; least-privilege roles; session timeouts; managed detection-and-response with isolation authority on contractor hardware
PR.AA-05, PR.PS-02, PR.IR-01; MDR layer DE.CM-09 + RS.MI-01
(c) Direct unauthorized login to the tool, bypassing MFA
MFA has blocked stolen credentials before
Plausible, low
Accept — record owner, date, review trigger (an MFA-bypass technique against this tool seen in the wild)
ID.RA-06, PR.AA-03
(d) Vendor's own systems compromised; company data exfiltrated from their side
Their ticketing and file stores hold what support transfers carry
Plausible
Transfer — security clauses, right to audit, breach notification, liability allocation; cyber insurance covering third-party events. Plus mitigate: reduce what leaves via transfer
GV.SC-05, GV.SC-10, GV.RM-04, PR.DS-01
(e) The vendor security relationship was never defined, signed, or enforced
Oversight control exists in the catalogue, status "blocked"
Certain, present state
Mitigate (Govern) — named owner, audit cadence, attestation, device standard, contractor identity lifecycle
GV.SC-01/02/06/07, GV.RR-02

Missing governance input: no tolerance for third-party remote access into the fleet. Draft: "The company will not grant privileged fleet access from any device it cannot attest; where a third party requires it, the device standard, endpoint protection, and audit right are contractual conditions of access."
Where a typical proposal lands: "Deploy endpoint detection on the contractors' machines." That is a real mitigation on the infected-device state behind (a) and (b) — enforceable if the contract allows the company to dictate tooling — and worth doing. Adopted as the whole answer, with nothing decided on (c), (d), or (e) and no evaluation recorded, it becomes the pattern: a good control on one branch standing in for a decision on the parent.
Guidance: write the tolerance sentence and put it to the executive who owns the support relationship; un-block the vendor oversight control by naming an owner this month; record (c) as the acceptance it already informally is, so the register holds an Accept and a Mitigate side by side — which also tests whether the register can.
One row became one parent, five children, four dispositions, and one tolerance. That is what "breaking it down" means, and it is what a register must be able to hold.
6.3 A second example, briefly
Input: a register row titled "Developer access token misuse / unmanaged lifecycle," listing several unrelated credential types, pre-set to Mitigate, with a remediation plan of "inventory, expiry alerting, monitor usage."
What is wrong with it: it conflates credential types (user-bound source-control tokens, service API keys, OAuth grants) and threats (external theft, insider misuse, leaver exfiltration, orphaned tokens); it names an "existing control" (a secrets-in-code scanner) that addresses a different risk; it pre-sets the treatment; and it asks for usage monitoring on a platform that does not log the one event that matters — a repository clone with a valid token.
The harm it never states: source code and the customer data reachable through it leave the company's control, or an identity keeps acting after trust has ended, because tokens satisfy authentication with no device signal and personal devices are permitted.
The branch that matters: an authorized user clones code to an unmanaged device. It is certain, it is permitted by policy, and it is invisible to monitoring. It can only be avoided (bind code access to attested devices) or accepted in writing per population. It cannot be detected. Everything else in the row — token hygiene, offboarding revocation, leaked-token alerts — is real, contained, worth doing, and does not touch that branch.
The settled position to argue toward: if long-lived tokens are possible and personal devices are allowed, assume code is on any device and defend from there — code-integrity controls, signing, secrets out of repositories, fast revocation — rather than naming leak-prevention as the strategy.

7. Anti-patterns to name at intake
Each has a signature and a one-line reason it is wrong in framework terms. Name the pattern once, factually, and move on. The breakdown does the arguing.
Pattern
Signature
Why it is wrong
Monitoring as response
"We'll monitor it," "set up an alert," "get me the data on who is doing it"
Detect finds what already happened; it does not change likelihood. Offered as the response, it skips assessment and leaves the preventive option unexamined
Finding as risk
A scanner hit or audit exception written into the register as a row
A finding is evidence a control is not holding; the risk is the harm the control exists to prevent, usually already in the catalogue
Tool-named risk
"Misuse of [system]," "[service] exposed," "Shadow IT"
Describes a control failing, not a harm; often points at the least likely path while the real mechanism goes unnamed
Acceptance as precursor
A workflow where "awaiting acceptance" means the owner signs the remediation plan, and "mitigated" is the only done state
Three of four responses cannot be recorded; the register forces control-everything and informal acceptances have nowhere to live
Denominator thinking
Sizing a risk by headcount or event count: "only eight people use it"
Impact is a function of what the asset holds and authorizes, not how many people touch it
Metrics before control
Repeated asks to measure a behavior where a control already exists and is unenforced
Measurement serves a decision; when the control exists, the decision is whether to enforce it, not how to count violations
Proof of a negative
"Prove to me that X is not happening"
Inverts the burden and produces surveillance data in place of a control; the answer is a tolerance statement and an enforced control
Every risk must have a control
A risk raised without a mitigation in hand is treated as an unfinished thought
Raising a risk and deciding to accept it is the process working; demanding a control first is the first cycle reasserting itself


8. Register design
The register is a decision log, not a work tracker. It needs to hold four kinds of done state, a parent–child relationship, and a link to controls and findings without merging with them.
8.1 Workflow
Identified → Assessed → Decided (Accept | Avoid | Transfer | Mitigate) → Treatment (Mitigate only) → Monitored
Decided is the governed step. Three of the four responses close here, with owner and date.
Treatment exists only for Mitigate. It links to the work tickets; it is not the same object.
Monitored carries residual risk and a review date. "Mitigated" is a residual-risk statement, not a done button.
8.2 Required fields
Field
Why it is required
Harm sentence (the risk statement, in the fixed form)
The filter; it is what tool-named and finding-shaped rows fail
Control link (one or more)
The join to the catalogue; refused at intake if empty
Owner outside the security function
Business owns the decision
Likelihood (precedent / probable / plausible / remote)
From evidence, not adjectives
Severity (catastrophic / major / moderate / minor)
Four words are enough at this scale
Response (one of four)
Set by the decision forum, never pre-set by the author
Decision owner and date
The record of ID.RA-06
Residual risk and review date
What is being carried, and when it is looked at again
Tolerance referenced
Which of the five to seven sentences this compares to
Parent / child
A branch points at its parent; a parent lists its branches

8.3 What the register must be able to do
Close a row as Accepted, with no remediation plan attached, and have that be a normal, visible, reviewable state.
Hold a parent risk and its branches as linked rows with different dispositions.
Link to a finding in the ticket queue without the finding being a register row.
Show, at a glance, the share of risks with a recorded decision and a named owner. That is the one metric that matters.
8.4 Intake refusals
Six rules, applied at the door, prevent most malformed rows:
No harm sentence → not a risk; route to findings or tasks.
No control link → return to author.
No named owner outside Security → not accepted into the decision forum.
Treatment pre-set → cleared; the forum decides.
"Existing control" named without a link to its record and status → removed.
More than one credential type, mechanism, or population in one row → split.

9. Tolerance statements
Tolerances are the governance input that makes every downstream argument about something other than tools. Without them, every conversation is "should we buy X" or "should we monitor Y." With them, the conversation is "is this exposure inside or outside what leadership said it would carry."
9.1 How many, who writes them, how often
Five to seven. Written by the executive team with the security lead drafting. Reviewed quarterly; adjusted when the business changes, when an incident reveals the stated tolerance was not the real one, or when a tolerance has been breached for two consecutive quarters without a decision.
9.2 The form
One sentence each: "The company will / will not carry [exposure] beyond [threshold]." The threshold can be qualitative. The sentence should be one a non-technical executive can read and sign.
9.3 Typical subjects for a growth-stage technology company
Access to source code and production from devices the company cannot attest, by population (employees, contractors).
Third-party remote access into customer environments or the production fleet.
External exposure of production APIs and the change control on the edge that protects them.
Customer-data access by integrators, partners, and support tooling.
AI tooling: data leaving managed environments; uncontrolled spend.
Payment, billing, or financial-flow fraud loss and dispute liability, where applicable.
Availability: single-region or single-zone dependence and the recovery time the business will tolerate.
Each risk's breakdown ends by comparing its residual to one of these. If no sentence covers it, that absence is itself the finding, and drafting the sentence is the first move.

10. The operating model
The whole program, at the scale of 50 to 500 people, runs on roughly three hours a week across the company.
10.1 Roles
The business owns the decision. Every risk has a named owner outside the security function: the executive or team lead whose objective is harmed. They choose the response.
Security owns the assessment. Classification, breakdown, evidence, catalogue join, framework placement, proposed response. Security proposes; it does not decide.
The accountable seat owns the record. Whoever holds the risk-management control (typically the CISO or the executive the security lead reports to) records the decision, keeps the register honest, and escalates breaches of tolerance.
Accept is a normal answer and carries no stigma. An undeclared acceptance — a risk everyone knows about that nobody has written down as accepted — is the only failure state.
10.2 Cadence
Rhythm
Length
Who
Purpose
Weekly
30 min
Security + one rotating engineering lead
Triage: classify intake, join to catalogue, propose a response
Monthly
45 min
Risk owners + the accountable seat
Decide and record; review items past their review date
Quarterly
60 min
Executive team
Adjust tolerance statements; read the residual trend; look at the one metric

10.3 Where it lives
In the tools people already open. The register in the ticketing system, reshaped as above. The control catalogue in whatever holds it today (a wiki, a database, the compliance platform), with the Risk field added. Findings in the engineering ticket queue, linked to controls. Intake through one chat channel and one short form that the weekly triage reads. The breakdown form carried into design reviews for anything new, so that new systems arrive with their parent risk and branches already written.
10.4 Detect sized to what was accepted
Monitoring proposals enter through the same form as everything else and must name the parent risk, the branch, the half of the branch (before or after compromise), and the decision they support. Each detection rule carries a one-line business case and a written statement of what it cannot see. A monitor offered as the response to a parent risk is returned with the breakdown attached. This single rule keeps the Detect function from becoming the de facto control strategy.

11. A maturity path by company size
Up to about 50 people. One person owns security part-time. Do three things: write the five tolerance sentences with the founders; adopt a control catalogue from whatever framework customers will eventually ask about, and write the Risk field for each control; run the breakdown on anything that surfaces. No register yet beyond the catalogue's Risk fields. Accept freely and write it down.
50 to 150 people. A security lead exists. Add the register as a view over the catalogue (one row per distinct harm, lowest implementation first). Start the weekly triage with a rotating engineering lead. Start the monthly decision forum with the three or four executives who own most harms. Add the scenario table. Resist the compliance platform's workflow if it cannot hold an Accept.
150 to 500 people. Multiple engineering teams, a payments or data business line, third parties with privileged access. Formalize the three roles. Add parent–child to the register. Put the breakdown form into design review. Begin quarterly tolerance review with the full executive team. Expect the catalogue to reach 100 to 150 controls and the register 40 to 60 parent risks. This is also the point at which the program becomes defensible to an auditor as a risk-based program rather than a checklist — because the decisions are written down.
At no stage is a scoring matrix, a heat map, or a quantitative model required. They can be added later; their absence is not what is holding the program back.

12. Pitfalls when adopting a compliance platform
Compliance platforms are useful as evidence catalogues and bridges to auditors. They become harmful when they are allowed to be the authority on security design or risk decisions.
The platform's risk module probably cannot hold an Accept as a done state. Check before adopting its workflow. If it cannot, keep the register in the ticketing system and use the platform for evidence only.
Automated tests produce findings, not risks. Route their output to the finding queue, linked to controls. Do not let the platform populate the register.
Clean dashboards are not proof of health. A mature program has a source of truth of its own and surfaces failures when they exist. The platform should read from that source, not replace it.
Deep integrations are a risk decision in themselves. Connecting a platform to every cloud account gives one vendor visibility into every service the company runs. Treat the connection as a transfer-of-exposure decision and record it.

13. Templates
13.1 Harm sentence
[Who] suffers [what] because [standing condition].
Consequence to the company: [reputational / legal / financial / operational].
Severity: [catastrophic / major / moderate / minor].
13.2 Breakdown record
# <Short topic> — risk breakdown

## Quick placement
1. Object: <harm | mechanism | threat branch | finding | control gap | governance gap | proposed response>
2. Cycle position: entered at <Function>; should have started at <Function>.
3. Anti-pattern: <name | none>
4. Parent risk: <harm sentence>
5. Next move: <one sentence, with owner>

## Parent and mechanism
Parent — <harm sentence>. CSF: <refs>.
Mechanism — <standing condition>. CSF: <refs>.

## Branches
| # | Branch | Evidence | Likelihood |
| a | | | precedent / probable / plausible / remote |
| … | | | |
| n | Governance gap underneath: <what nobody owns> | <status> | certain, present state |

## Responses
| Branch | Response (one of four) | Concretely | Owning control (state) | CSF 2.0 |

## Missing governance input
Tolerance: <exists at … | does not exist>. Draft: "The company will / will not carry <exposure> beyond <threshold>."

## Where the current proposal lands
<branch, half, Function; what it changes and does not change>

## Guidance
1. <move> — owner — what to say
2. …
3. …
13.3 Tolerance statement
The company will / will not carry [exposure] beyond [threshold].
Owner: [executive]. Reviewed: [quarter]. Risks compared against this: [register ids].
13.4 Monitoring proposal
Parent risk: <register id>
Branch: <id> — half: <pre-compromise | post-compromise>
Function / subcategory: <DE.CM-xx / DE.AE-xx / RS.MI-xx>
Decision this supports: <which response on which branch>
What this monitor cannot see: <one sentence, written down>

14. The one-paragraph version
Risk starts with a harm sentence, not a finding and not a tool. Controls are the spine; risks and findings link to them, and the control catalogue the compliance framework already provided is the place to begin. Every item is broken down the same way — harm, mechanism, branches, one response each, framework placement, tolerance check — in about twenty minutes. The business owns each decision, security owns the assessment, one accountable seat owns the record. Five to seven tolerance sentences written by leadership make every argument about exposure instead of tools. Detection is sized to what was accepted and never substitutes for the decision. Accept is a normal answer; an acceptance nobody wrote down is the only failure. Three hours a week, no scoring matrix, and a register that can hold all four dispositions.

References
NIST Cybersecurity Framework 2.0 (CSWP 29), February 2024 — the six Functions, categories, and subcategories referenced throughout (GV.RM, GV.SC, ID.RA-06, PR.AA, DE.CM, and others).
NIST SP 1303, CSF 2.0 Enterprise Risk Management Quick-Start Guide — the six activity points, the four risk responses, and the register contents.
NIST SP 1299, CSF 2.0 Resource and Overview Guide — Function definitions.
NIST IR 8286 series, Integrating Cybersecurity and Enterprise Risk Management — register design (8286A) and response prioritization (8286B).
ISO 31000:2018, Risk management — Guidelines — the general vocabulary of appetite, tolerance, and treatment, compatible with the above.

