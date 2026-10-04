---
title: SaaS Settings Baseline — a 100+ item checklist crossed with an automated settings scanner
category: analysis
system: Google Workspace (method applies to any SaaS admin console)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, monitoring-google-workspace, access-reconciliation, access-identity-lifecycle, analysis-sso-adoption-metrics]
---
# SaaS Settings Baseline — a 100+ item checklist crossed with an automated settings scanner

## Why this matters
Vendors publish security checklists for their own platforms (Google's "security checklist
for 100+ users" is the model here) and third-party scanners promise to grade your tenant
against them. Neither is sufficient alone. The vendor list is complete but has no
knowledge of your tenant; the scanner reads your tenant but covers a fraction of the list,
reports "Compliant" against a permissive default, and its summary may not even agree with
its own body.

The method: build one evaluation sheet where every checklist item has a **stable control
id**, the scanner's verdict is one column among several, and the compliance test is a
**target-state column you write** — not the scanner's green. The sheet is the baseline a
later control-plane module syncs against, the join key for re-scans, and the vocabulary
for every future evaluation.

## Data sources & access method
| Source | Method | Yields |
|---|---|---|
| Vendor security checklist | manual transcription (once), kept as the row spine | domain, setting, guidance tier (required / recommended / consider), admin console path, edition note |
| Workspace settings scanner report (a "policy analyzer" export) | markdown/PDF export, parsed by section | per-policy status (Compliant / Warning / Needs Assessment / Non-Compliant), description, sometimes a current value, org unit |
| Admin console (read) | manual verification, or Admin SDK / Policy API where available | the actual current value and OU inheritance |
| Admin audit / login audit (SIEM) | events connector | evidence that a setting is enforced in practice (e.g., less-secure-app sign-ins, external sharing events) |
| Identity/MDM/SIEM context | the control-plane's other modules | which recommendations are already satisfied by another system (IdP MFA, device trust, SIEM retention) |

## Collection tactics
- **Assign stable ids** (`GWS-001 … GWS-nnn`) in checklist order on first build and never
  renumber; new items append. Re-scans, tickets and the future module all join on the id.
- **Parse the scanner body, not its summary.** Itemise every policy section into rows
  (name, status, description, current value if present). Count by status yourself.
- **Record the summary's counts separately** and diff them against your itemised counts;
  a mismatch is itself a finding about the evidence source.
- **Capture current values** wherever the scanner or console gives them; "Enabled (true)"
  beside a recommendation to disable is the whole point.
- **One row per setting, one setting per row**, even when the scanner collapses several
  into one policy; otherwise a partial pass hides a fail.
- Keep the sheet as the artifact of record (xlsx/CSV), with a date in the filename; the
  control-plane later imports it as a dataset and snapshots re-scans.

## Normalization & joins
Columns (the template that held up):
| Column | Content |
|---|---|
| id | `GWS-nnn`, stable |
| domain | account security · admin · apps · Gmail · Drive/Docs · Chat · Meet · Sites · Groups · mobile/endpoint · Classroom … |
| setting | the checklist wording |
| vendor guidance / tier | what the vendor recommends and how strongly |
| admin console path | where to change it |
| edition note | only on some SKUs |
| scanner item / status | the scanner's row joined by name (null when not scanned) |
| current value | from scanner or console |
| evaluation | **Meets · Meets – revisit · Gap – verify · Verify · Gap · N/A** |
| target state | the value this tenant should have (the compliance test) |
| recommendation | the change, or why N/A |
| priority | High / Medium / Low |
| owner | role, not person |
| verification method | console path, API call, SIEM query, or scanner re-run |

Join scanner → checklist by normalised setting name (case-folded, punctuation stripped),
then by hand for the remainder; expect roughly a third of checklist items to have a
scanner counterpart. Every unmatched checklist row keeps evaluation `Verify` until a human
or API reads the console.

**Tenant context assumptions** (state them at the top of the sheet): which system is the
IdP and MDM, which chat/meeting tools are in use (so the vendor's own chat/meet/sites may
be *turn-off* candidates), which SIEM holds audit logs, and which recommendations are
satisfied upstream (e.g., MFA enforced at the IdP makes the suite's own 2SV setting a
defence-in-depth row, not a gap).

## Signals & finding rules
| Signal | Rule | Evaluation |
|---|---|---|
| Scanner Compliant but vendor says disable | e.g., super-admin self-recovery **Enabled** marked Compliant; vendor recommends disabling with ≥2 super admins | **Gap** — scanner Compliant is a floor, not a target |
| Scanner Needs Assessment, no value | the scanner knows the setting exists but did not read it | **Verify** |
| Scanner Compliant with a known current value equal to target | — | Meets |
| Compliant on a permissive default | setting matches vendor default, vendor tier is "recommended" stricter | Meets – revisit |
| Service not used by the tenant left enabled | chat/sites/classroom-style services with no business use | Gap — turn off (reduces surface) |
| Summary ≠ body | scanner headline counts disagree with itemised rows | evidence-quality finding; cite both numbers |
| External sharing / default link access | value broader than target (e.g., anyone-with-link default) | Gap, High |
| Mail authentication (SPF/DKIM/DMARC) | scanner "Needs Assessment"; verify DNS directly | Verify → Meets/Gap after DNS check |
| Less-secure apps / legacy protocols | enabled or unknown | Gap, High until verified off |
| Session length / login challenges / recovery | vs target by role (admins stricter) | per row |
| Super admin count | < 2 or > a small number | Gap |

Priority = High when the gap exposes data or admin takeover (sharing defaults, recovery,
legacy auth, admin count); Medium for hygiene (retention, recording, host controls); Low
for cosmetic or already-mitigated upstream.

## Analyst triage & evidence
- The **target-state column is the compliance test**. On every re-scan, compare current
  value to target, not scanner status to "Compliant".
- **Evaluation vocabulary** (reuse verbatim): Meets / Meets – revisit / Gap – verify /
  Verify / Gap / N/A. Pair each Gap with a recommendation, owner role and verification
  method.
- **Scorecard**: counts by evaluation and by domain; "scanner coverage" = checklist rows
  with a scanner counterpart ÷ all rows; "scanner agreement" = rows where scanner status
  and evaluation agree.
- **Analyst brief** (one sentence + ≤6 bullets): headline posture, the High gaps, the
  summary-vs-body discrepancy if any, scanner coverage %, next verification batch.
  Vocabulary CHANGE / VERIFY / TURN-OFF / ACCEPT / EXPECTED.
- **Evidence**: the dated sheet, the scanner export it was built from, console screenshots
  or API reads for each `Meets`, and the SIEM query used for behavioural evidence. When a
  control-plane module exists, import the sheet as a dataset keyed by id; each re-scan is a
  snapshot; history diffs show which ids changed evaluation.

## Pitfalls & lessons learned
- The scanner's executive summary reported one set of counts while its body itemised a
  different, larger set with zero non-compliant rows and almost no current values. Trust
  neither until reconciled.
- "Compliant" on account-recovery settings reflected the vendor's lenient default, not the
  stricter guidance for larger tenants.
- Settings scanners rarely cover Drive sharing defaults, mail authentication, or
  third-party app access with real values — those need the console or DNS.
- Services the business does not use (classroom-style, sites, built-in chat) show as
  Compliant because their sub-settings are fine; the better answer is to disable the
  service.
- Renumbering ids after the first sheet breaks every downstream join; append only.
- Owner must be a role; people change, sheets persist and get shared.

## Do not
- Do not treat scanner "Compliant" as the target; write the target state yourself.
- Do not use the scanner's summary counts as evidence; itemise the body.
- Do not merge several settings into one row.
- Do not renumber control ids.
- Do not record people's names as owners in a distributable sheet.
- Do not mark `Meets` without a current value read from the console, API or scanner.

## Related steering files
- monitoring-google-workspace — admin/login audit events as behavioural evidence
- access-reconciliation — licence and account state in the same suite
- access-identity-lifecycle — admin account count and recovery settings tie to joiner/leaver
- analysis-sso-adoption-metrics — IdP MFA and device trust satisfy suite-level rows upstream
- foundation-evidence-datasets-snapshots — importing the sheet as a dataset with history
- foundation-ai-analyst-triage — the brief contract
