---
title: Identity Lifecycle — Joiner, Mover, Leaver Reconciliation
category: access
system: people system-of-record × IdP (JumpCloud) × Google Workspace (× Microsoft Entra) × offboarding form × ticketing
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [access-reconciliation, access-groups, analysis-access-revocations, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, monitoring-jumpcloud, monitoring-google-workspace]
---
# Identity Lifecycle — Joiner, Mover, Leaver Reconciliation

## Why this matters

Offboarding is where access control is most often proven wrong. The roster says someone left; the IdP still has them activated; the mailbox still receives; the leaver ticket is still open; the manager never filed the offboarding form. Each gap is an audit exception and, for a disgruntled leaver, a live door. The method here reconciles the people system-of-record against the IdP and Google Workspace (and Entra where present), cross-checks the offboarding request intake and the leaver ticket, grades every person with deterministic rules at read time, and renders an access-review report with a captured snapshot so each review is reproducible and diffable against the previous one.

## Data sources & access method

| Source | What it supplies | How it is read |
|---|---|---|
| People system-of-record | Status (Active / Coming / Going / Gone / Suspended / Preserve / Service Account / Ignore…), type (employee, contractor, intern, external-no-identity), start date, terminated date, leaver-ticket link | Reuse the account table filled by access reconciliation — no second pull |
| IdP (JumpCloud) | Account state ACTIVATED / SUSPENDED / STAGED / absent | Local `jc_users` table from the Identities sync |
| Google Workspace | active / suspended / archived / absent | Reuse the reconciliation account table (live Directory; snapshot or CSV import downgrade to LEAD) |
| Microsoft Entra ID (optional) | accountEnabled, guest vs member | Graph via delegated token; same account table |
| Offboarding request form | Submission timestamp, submitter (manager) email, full name of leaver, department, last working day, suspension timing, reason, legal hold yes/no, successor, equipment collected | Google Sheets API, read-only scope, one fixed range from the header row through the last mapped column |
| Leaver ticket | Status, resolution date for the ticket linked on the roster record | Local ticket cache first, then read-only `GET /rest/api/3/issue/{key}?fields=status,resolutiondate` |

Access rules: every credential is read-only except the IdP suspend action (below). The form sheet range is requested by explicit bounds; free-text answers beyond the mapped columns are never pulled.

## Collection tactics

- **Form intake parsing is header-driven, never positional.** Google Forms appends a column whenever a question is added and headers carry stray whitespace and newlines. Map each column by normalized header *prefix* ("last working day", "is this person under a legal hold", …), most specific first. Refuse to sync if the timestamp and full-name headers are not found.
- **Stable request key** = form timestamp + normalized name (row number is not stable; two same-second submissions get a row suffix).
- **Test rows are flagged, not dropped** (`is_test`): placeholder names, "test" variants, filler repeated across identity fields.
- **Zero-row pulls are refused.** A full-sweep lifecycle (`first_seen / last_seen / gone_at`) applies on success only.
- **Store only mapped fields.** The `raw` column holds the same mapped fields, never the sheet row.
- **Leaver tickets**: extract the ticket key from the URL on the roster record with a generic `[A-Z][A-Z0-9]+-\d+` pattern; done = category Done or a status matching done/closed/resolved/complete. The URL itself is not exported — presence plus key only.
- **Sequential refresh order**: form sheet → roster → Google → IdP → tickets → labelled snapshot. Same order in-app ("Refresh all") and in the scheduled script.

## Normalization & joins

**Request → person matching.** The form has no leaver email; "Email Address" is the submitter (the manager). Match on name against the roster:

| Confidence | Rule | Score |
|---|---|---|
| exact | full normalized name equal; or first + last token equal (middle names ignored) | 100 / 90 |
| fuzzy | nickname table (first) + same last | 70 |
| fuzzy | `firstinitial+lastname` matches the local part of a roster email on the corporate domain | 65 |
| fuzzy | first-name prefix (≥3 chars) + same last | 60 |
| fuzzy | same first + a shared surname token (≥3 chars) | 55 |
| link | manual override table (request_key → roster id) | — |
| none | no match, or a tie that survives the leaver-status tiebreak | — |

Normalization: strip accents, parentheses, apostrophes, suffixes (jr/sr/ii/iii/iv), reorder "Surname, Given". Ties prefer Going/Gone/Suspended/Preserve records; a remaining tie is **ambiguous = none**, never a guess. Fuzzy matches are labelled on every surface ("(fuzzy match)") and are not gating in the access review.

**Accounts → person claims.** IdP and Google rows are claimed by the roster record whose email (or alias email) matches. An account also claimed by a *live* roster record is `shared_with_active` (graded INFO, not violation). Unclaimed accounts are orphans. Google is only *expected* for people on a Workspace domain — derive the domain set from the Google directory itself.

## Signals & finding rules

Pure rule engine, evaluated at read time, unit-tested without DB or network. Verdict ranking: VIOLATION > ORPHAN > DISAGREE > LEAD > WARN > HOLD > GAP > INFO > PASS > EXCLUDED > EXEMPT.

| Roster state | IdP state | Google state | Verdict (severity) | Kind |
|---|---|---|---|---|
| Active / Coming after start | absent | — | DISAGREE (medium) | IDP-GAP |
| Active | suspended | — | DISAGREE (medium) | JC-SUSPENDED-ACTIVE |
| Active | staged | — | WARN (low) | JC-STAGED |
| Active | — | absent on a Workspace domain | DISAGREE (low) | GOOGLE-MISSING |
| Active | — | suspended / archived | DISAGREE (medium) | GOOGLE-SUSPENDED-ACTIVE |
| Coming before start | active | — | INFO | PRE-START |
| Going, term date not passed | active | active | WARN (low) | GOING-*-ACTIVE |
| Going, term date passed | active | — | VIOLATION (high) | GOING-JC-PAST-TERM |
| Going, term date passed | — | active | VIOLATION (high) | GOING-GOOGLE-PAST-TERM |
| Going, no term date | — | — | WARN (low) | GOING-NO-TERM |
| Gone | active / staged | — | VIOLATION (critical) | GONE-JC-ACTIVE |
| Gone | suspended | — | DISAGREE (medium) — must be deleted | GONE-JC-EXISTS |
| Gone | — | active | VIOLATION (high) | GONE-GOOGLE-ACTIVE |
| Suspended | active | active | VIOLATION (high) | SUSPENDED-*-ACTIVE |
| Preserve | any | any | HOLD (info if documented, medium if not) | HOLD / HOLD-UNDOCUMENTED |
| Service Account / Ignore / Group / Alias / shared | — | — | EXCLUDED | — |
| no roster record | active / staged | — | ORPHAN (high) | ORPHAN-JC |
| no roster record | — | active | ORPHAN (high) | ORPHAN-GOOGLE |
| no roster record | suspended | archived | INFO | ORPHAN-INACTIVE |

Cross-checks layered on top:

| Condition | Verdict | Kind |
|---|---|---|
| Offboard request exists but roster still Active | DISAGREE (medium) | REQUEST-NOT-REFLECTED |
| Request last day passed, roster still Going | WARN (low) | REQUEST-PAST-STILL-GOING |
| Going/Gone terminated since the form began, no request on file | GAP (low) | NO-REQUEST |
| Terminated date vs request last day differ by > 3 days | INFO | TERM-DATE-MISMATCH |
| Recent leaver, no leaver ticket on the roster record | GAP (low) | NO-DOC-LEAVER |
| Leaver ticket open and roster Gone | WARN (low) | DOC-LEAVER-OPEN |
| Any Google finding resting on a snapshot source | LEAD (low), verb prefixed "VERIFY first" | — |
| Identity-level exemption in force | EXEMPT (Preserve: the reason documents the hold instead) | — |

A documented hold = the request says Legal Hold = Yes, or a recorded exemption carries the reason. Each row carries `actions[]` `{system, verb, why}` ordered IdP → Google → roster → ticketing → form.

## Analyst triage & evidence

- **Access review report** (HTML print view or Markdown): scope = Going/Gone by terminated-date window (30 d default) or a pasted name/email list sent in the POST body, never a URL. Per leaver: roster Going/Gone · leaver ticket exists and Done · IdP suspended or absent · Google not active · offboard request on file. The request check is *reported, not gating* — process evidence, not access state. Snapshot Google = `unverified`. Headline "N pass / M fail", exceptions with follow-up text per failed check, population and source modes, reviewer and date.
- **Capture before you render.** The report captures a labelled dataset snapshot first and prints its id and hashes, then computes "Since last review" as a diff against the previous access-review snapshot. The hashes in the document are the state the document was built from.
- **Dataset**: collections `person` and `request`; entity hash = person + states + verdict; source mode/freshness moves only the state hash; a failed, empty, or snapshot source marks the snapshot incomplete so absent entities are never closed as removed.
- **Analyst triage vocabulary**: REVOKE · REMOVE (delete the lingering suspended account) · RECORD (fix the roster) · RECERTIFY · EXPECTED · HOLD · LEAD.
- **Suspend action with guardrails** (lives on the identities page, linked from every lifecycle row): id must be a 24-hex IdP id; preview reads live state and the last 3 days of auth-shaped events; execute `PUT /api/systemusers/{id} {suspended:true}`, mirrors locally, idempotent on already-suspended; the drawer demands a second explicit click. Group removal for suspended users is a separate planned/approved bulk gate (see access-groups).

## Pitfalls & lessons learned

- **The agent was never loaded.** A daily scheduled sync was templated as a launchd-style agent and committed — and not loaded. Weeks later the data was stale and nobody noticed because the page showed *last sync* in small type. Make staleness loud (banner when any source is older than the schedule), and verify `launchctl list` (or your scheduler) actually shows the job.
- **Scripts talk to the local server only.** The sync script refuses a non-loopback base URL, posts existing routes one at a time, logs each step, continues on failure, and exits non-zero so a scheduler can alert. No secrets in the script — the server holds credentials.
- **Name matching is a risk, not a feature.** It exists because the form lacks the leaver's email. Fix the form (add a required leaver-email field) and keep the matcher as fallback. Until then, show confidence on every surface and never gate a review on a fuzzy match.
- **Defaults nobody confirmed.** Several state rules (e.g. Gone + suspended IdP = DISAGREE rather than PASS) were chosen by the builder when the owner said "go" without answering. Record which rules are owner-confirmed and which are defaults, and revisit.
- **Shared accounts.** A leaver's IdP account re-used by an active person looked like a violation; the `shared_with_active` flag fixed it.
- **Snapshot Google** showed leavers as active weeks after suspension — the LEAD downgrade exists for this.
- **Term-date hygiene** drives everything: Going without a terminated date cannot be graded past-term. Nag for it.

## Do not

- Do not match requests to people silently; label exact vs fuzzy and expose a manual link override.
- Do not pull free-text form answers or the leaver-ticket URL into exports.
- Do not request whole-sheet ranges; bound the range to the mapped columns.
- Do not treat the offboarding request as access evidence — it is process evidence.
- Do not grade a snapshot-sourced Google state as VIOLATION.
- Do not run the scheduled sync from outside the host or with its own credentials.
- Do not render the review before capturing the snapshot it cites.
- Do not let a Preserve hold stand without a documented reason and a review date.

## Related steering files

- access-reconciliation — the shared account table and the Google/roster pulls this page reuses
- access-groups — bulk group removal for suspended leavers
- analysis-access-revocations — proving revocations landed across systems
- foundation-evidence-datasets-snapshots — snapshot capture, hashes, since-last diffs
- foundation-ai-analyst-triage — triage vocabulary and packet shape
- foundation-privacy-safety-secrets — Sheets scopes, token storage
- monitoring-jumpcloud, monitoring-google-workspace — telemetry companions
