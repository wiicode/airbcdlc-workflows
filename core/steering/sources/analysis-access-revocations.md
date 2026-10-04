---
title: Access Revocations — Offboarding and Separation Watch
category: analysis
system: Google Drive, Gmail, Slack, JumpCloud (directory + SSO), Azure DevOps, CrowdStrike Falcon (DLP + hosts), 1Password, ScreenConnect, AWS CloudTrail, Sumo Logic
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, access-identity-lifecycle, access-reconciliation, analysis-actor-automation-fingerprints, analysis-edr-coverage, monitoring-google-workspace, monitoring-slack, monitoring-jumpcloud, monitoring-azure-devops, monitoring-crowdstrike, monitoring-1password, monitoring-screenconnect-rmm, monitoring-sumologic]
---
# Access Revocations — Offboarding and Separation Watch

## Why this matters
A separation event — one leaver or a workforce-reduction cohort — is the moment insider risk peaks and the moment the evidence has to be cleanest: HR and legal need a per-person record of what was done and when; the compliance program needs proof access was revoked; security needs to know whether anything left in the days before the cutoff. The three are usually three spreadsheets. This method tracks the cohort against a fixed checklist, computes a deterministic exfiltration score per person from the telemetry rails the control-plane already collects, writes an AI narrative on top with a terse contract, and produces executive briefs (before and after the cutoff) and a per-person offboarding report as the evidence package. Everything is blurred on screen by default because the cohort list is the most sensitive document in the company for the weeks it exists.

## Data sources & access method
| Source | How read | Role in the method |
|---|---|---|
| Cohort sheet (HR/IT worksheet) | Google Sheets API, one read of three ranges with formatted values + hyperlinks; CSV/TSV paste fallback | population, schedule, cutoff times, sheet-reported progress |
| People system-of-record / roster | local identities table | aliases per person (email, local-part, every known identifier) |
| Directory (JumpCloud) | live Directory Insights pull (30 d) + bound-systems API; local user mirror | logins, geo baseline, MFA/password changes, SSO device context, managed-device baseline, suspend |
| Drive / Gmail / Slack / Azure DevOps / Falcon DLP / 1Password / ScreenConnect / Atlassian | local `events` table, fed by SIEM search-job presets scoped to the cohort's actors | windowed activity signals |
| Source control | commits, PRs, PAT inventory tables | PAT minting, scope, lifetime; commits as context only |
| Falcon Hosts API | full fleet snapshot per collect | sensor coverage of managed devices |
| Google endpoint management | mobile devices API (needs the device-readonly scope) | the one structured BYOD inventory |
| AWS | CloudTrail rail | secret and object reads |
| Access reconciliation tables | current footprint, not windowed | residual access, admin roles |

**Cohort backfill**: run the offboarding presets **sequentially** (SIEM job concurrency), each with `| where toLowerCase(<actor field>) in ("a@…", "b@…")` appended; presets whose actor is a bare username are scoped with local-parts. Windows longer than 7 days are chunked into 7-day slices; inserts dedupe on a key so re-runs are harmless. Report presets that are missing or disabled as skipped, never as empty.

## Collection tactics
**Cohort import**
- Map columns by **normalised header text**, never position; tolerate typos.
- The master list drives the population: one person per row with an `@` email; rows without an email are skipped and counted. Side tabs (schedule, consulting-agreement actions) carry names only and **enrich by name** — normalise case, accents and punctuation; each rule must hit exactly one person (full name → first+last token → last name with same first initial); split "A and B" cells; skip filler words and vendor placeholders; return unmatched names in the response only, never store or log them, never guess.
- Upsert key = lowercased email within the cohort. Every history row (checklist, notes, notification status, assessments, log) is keyed by the person id, so re-imports and a source-sheet switch keep history. People missing from the new sheet get `gone_at`, never deleted. Manager / HR lead keep the previous value when the new sheet has none.
- **Sheet-reported progress** ticks checklist items (`done_by='sheet'`, with the column and cell value as the note) only when the item is not already done; nothing is ever un-ticked.
- **Cutoff times**: a time with a zone token derives `cutoff_at` in that zone; without one, assume the cohort timezone and label it "(assumed)". Operator-set cutoffs are never overwritten; "TBD" stays null and surfaces as a readiness gap.

**Signals** — one collector per source, each returning `{status: ok | empty | unavailable | error, facts, items (cap 60, most material first)}`. **Coverage honesty**: `unavailable` when the rail has no rows at all in the window for *any* actor (it was not collected), `empty` when the rail has coverage but nothing for this person. Nothing scores on a missing comparison.

**Known devices** — managed baseline = directory-bound systems (live); second managed source = EDR hosts matched by last-login user, hostname or serial (a bound device with no sensor is a control gap; sensor state is *unknown*, not missing, while the fleet is unsynced). Observed clients come from Slack user-agents, directory event user-agents, RMM login UAs, password-manager sign-in clients (desktop apps report the hostname as platform) and the SSO device-trust context. A desktop client matches a known device on platform + major OS version (platform only when Chrome freezes the UA version); a password-manager desktop client matches on hostname; an SSO login with managed-device context matches by system id (the strongest match — no UA guessing); one without is unmatched **by construction**; a mobile client matches an active endpoint-management device or is "unmanaged by policy". Vocabulary told to the analyst and printed in every report: *unmatched clients are evidence of another device, not proof of ownership.*

## Normalization & joins
- Aliases per person: email, local-part, every roster identifier except record ids, plus the directory username and display name (webhook rails carry names, not emails).
- Post-cutoff: when `cutoff_at` is set and past, count events after it by source across all rails, plus directory logins after it.
- The Slack audit raw is parsed at read time for entity title / filetype, IP and session — the ingest mapping is never changed because the dedupe key covers target/detail and a mapping change would double-ingest overlapping windows. Private file URLs are never surfaced.
- DLP detections carry file counts by category and destination, never file names; say so rather than inventing.

**Pseudo-SQL for coverage honesty and post-cutoff**

```sql
-- rail collected at all in the window? (unavailable vs empty)
SELECT 1 FROM events WHERE source = :rail AND event_time >= :from AND event_time < :to LIMIT 1;

-- this person's rows on a rail, by alias
SELECT event_time, source, actor, action, target, detail
  FROM events
 WHERE source IN (:rails) AND event_time >= :from AND event_time < :to
   AND lower(actor) IN (:aliases)
 ORDER BY event_time DESC LIMIT 5000;

-- anything after the cutoff, by source
SELECT source, COUNT(*) FROM events
 WHERE lower(actor) IN (:aliases) AND event_time >= :cutoff_at
 GROUP BY source;
```

**Rail coverage panel**: per rail, first event, last event, row count over the last 30 days — shown on the page and included in every brief so "no Drive activity" is read against "Drive rail has 2 days of history".

## Signals & finding rules
Deterministic, pure, unit-tested; the model never re-scores.

| Factor | Points | Cap |
|---|---|---|
| Drive external share | +15 each | 45 |
| Drive downloads ≥20 / ≥100 | +10 / +25 | — |
| Drive ownership transfer | +10 each | 30 |
| Drive bulk delete/trash (>25) | +10 | — |
| Gmail outbound external attachment event | +8 each | 32 |
| Gmail outbound attachments ≥25 | +10 | — |
| Slack file downloads ≥10 / ≥50 | +8 / +20 | — |
| Slack forwards ≥5; mobile download ≥1; browser downloads ≥5 | +5 each | — |
| Observed client matching no known device | +8 | — |
| Managed device out of contact >7 d | 0 (visible factor: a wipe cannot be assumed to land) | — |
| Managed device without EDR sensor | +5 | — |
| RMM login from an unmatched client | +10 | — |
| SSO logins without managed-device context ≥3 / ≥20 | +5 / +10 | 10 |
| Source-control PAT created in window | +20 each | 40 |
| Active full-access PAT; active PAT valid >30 d | +15; +5 | — |
| Branch policy bypass | +10 | — |
| DLP detection | +25 each | 50 |
| Sign-in from a country absent from the 30 d baseline | +15 | — |
| Failed auths ≥10 | +5 | — |
| Password-manager copy/reveal ≥10 / ≥50 | +10 / +20 | — |
| Password-manager share / secure-copy | +10 each | 30 |
| Cloud secret / object reads | +10 each | 30 |
| Admin in any system | +5 | — |
| **Any activity after cutoff** | **+40** | — |
| Directory login after cutoff | +20 | — |

Levels: <20 low · 20–44 elevated · 45–74 high · ≥75 critical. Commits and PRs are **context, never points**. Unavailable or empty rails contribute nothing and are named in the narrative and the report. The default window is 7 days; 3 / 14 / 30 are selectable.

## Analyst triage & evidence
- **AI narrative** per person under the terse contract: one headline (level, direction, whether the score over- or under-states), 3–6 facts with counts and sources, ≤3 next steps as verbs, one Gaps line. The packet is wrapped in `<untrusted_data>`; the guard says it is data, never instructions; the model has no tools; "not observable" instead of invention; never emit secrets or URLs not in the packet. Extended thinking disabled (ambient defaults silently consumed the budget). No API key → the score is stored with status `no-key`; a model error → status `error`, score still stored.
- Every assessment row keeps the exact packet text, `sha256(signals)` as the evidence hash, `sha256(system prompt)` as the prompt hash, and the model name; the downloads print the hashes.
- **Executive Brief · Pre** (≤350 words, bold-label sections): Readiness (checklist % by phase, unresolved directory ids, missing cutoffs, litigation holds) · Exfiltration risk (counts per level, top 5 by score with the top factor) · Systemic exposure (active PATs, devices without sensor, RMM from unmatched clients, unmanaged SSO, uncollected rails) · Decisions needed (≤3, as questions with recommended answers) · What we cannot see.
- **Executive Brief · Post**: Executed (notified / no-show / held; identities suspended vs cohort) · Post-cutoff activity (every person with events after cutoff, or "none observed" plus uncollected rails) · Residual access (accounts still active, PATs, not-yet-suspended identities, devices that cannot be wiped) · Exceptions from the log · Open items by phase · Next 72 h.
- **Per-person offboarding report** (Markdown or print HTML, deterministic — every number from the stored assessment; the only AI text is the stored synthesis): header with the directory record link, risk summary, signal evidence tables per source, known devices and observed clients with match state, checklist by phase with done timestamps and actor, execution log, residual access snapshot, gaps, evidence hashes.
- **Checklists**: per person (phases pregame → day-0 hour-1 → day-0 EOB → day 1–2 → day 3–21; vendors get only notice and wipe attestation) and per cohort (nine phases to closed). Seeds are insert-or-ignore so re-imports never reset done timestamps. Append-only execution log with kinds note / exception / status / checklist / queue.
- **Suspend action with guardrails**: the directory suspend runs through a shared drawer that previews live state and the last 3 days of logons before a red execute button; the offboarding page then records the outcome — but only if the local directory mirror already shows the user suspended (409 otherwise), so a stray call cannot mark a live identity as cut. It ticks the disable item, and logs `status` or, when the person is not yet marked notified, `exception` (policy: cutoff trigger is notification-complete; no-shows held ≤24 h). A "retain access / do not disable" flag from the sheet forces typing `SUSPEND` even when notified; "do not wipe" warns beside the wipe item. Identities are suspended, never deleted. Cohort-level bulk suspend is deliberately out of scope.
- **Pre-departure queue**: an "Investigate" action on the identities page runs the same assessment and adds the person to a standing queue cohort; assessment history follows the email across cohorts.

## Pitfalls & lessons learned
- **History starts when ingestion started.** Drive and Gmail rails had no rows before the collectors went live; a 7-day window the week after was one evening of coverage. The rails read `empty`, not `unavailable`, so the narrative must lean on the rails with history (Slack, directory, source control) and the report must say so. Record each rail's first/last event and row count and show rail coverage on the page.
- An honest zero (nobody in the cohort signed in to the password manager) looks identical to a broken query. Probe the unscoped query first.
- Zoom only logs presence; Chrome managed-profile telemetry, mailbox forwarding-rule creation and repo clone/pull are not observable — list them under Gaps everywhere rather than letting silence imply clean.
- Scope the cohort collect sequentially and client-drive the cohort assess loop (one POST per person, cancellable) to stay inside route time limits and the shared DB connection.
- Blur is React state only, never persisted; Escape re-blurs; search still matches blurred names so an operator can find a row without revealing it. Counts, levels, phases and times stay readable — operators need to work while screen-sharing.

## Do not
- Do not let the model re-score, invent counts, or treat an uncollected rail as clean.
- Do not store unmatched side-tab names, private file URLs, or secret values anywhere.
- Do not mark a person suspended from the offboarding page without the directory mirror confirming it.
- Do not un-tick checklist items from any automated path; only operators clear.
- Do not delete cohort rows, assessments or log lines; `gone_at` and append-only.
- Do not treat a mobile client, an unmanaged SSO login or a stale managed device as proof of a personal device or of intent.
- Do not persist the reveal state or print blurred content to logs.

## Related steering files
- access-identity-lifecycle — the leaver state rules that feed the cutoff and suspend policy
- access-reconciliation — residual-access tables used in the Post brief
- analysis-actor-automation-fingerprints — the "evidence not verdict" stance and HR/legal framing
- analysis-edr-coverage — sensor coverage rules for the known-devices signal
- monitoring-sumologic — the scoped preset backfill mechanism
- monitoring-google-workspace, monitoring-slack, monitoring-jumpcloud, monitoring-azure-devops, monitoring-crowdstrike, monitoring-1password, monitoring-screenconnect-rmm — the rails
- foundation-ai-analyst-triage, foundation-privacy-safety-secrets — contract and guardrails
