<!-- scope: steering · inventory · the people silo: why, minimum fields, sources, joins, freshness, attention. -->
# People — the identity roster, and why every security question ends here

**Status:** framework steering, working position 2026-10-01; derived from field practice; not yet reviewed by the author. Companion: `schemas/people.schema.json`, `rules/people.defaults.yaml`, `steering/inventory/devices.md`, `steering/inventory/access.md`.

## The desire, in the author's words

> "We manage people, not machines. I only care whether Joe or Jim has endpoint protection. I don't care that DESKTOP-49922 shows it."

> "Person → devices → tools-on-devices → policies-that-apply → evidence-that-proves."

## The strategy, in one paragraph

The roster is the one inventory that makes every other inventory answerable. A device without an owner is a liability you cannot assign; an access grant without a person is a review you cannot run; a training record without a learner is evidence of nothing. So the program acquires People first, keeps it as the single canonical list of humans and identities the company is responsible for, and resolves every identity-provider, HR, MDM, EDR and training source *onto* it — never the other way round. The roster's job is to be right about who should exist, in what state, from when to when; everything downstream reads that answer.

## What this silo is

One record per human or service identity the company is accountable for: employees, contractors, vendors' named staff with access, service accounts that act as identities. Not an HR system. Not the identity provider. The *reconciled* answer across all of them.

## Why it matters to a risk-based program

- **Protect.** It is the live inventory of humans that must be onboarded, offboarded and evidenced. Joiner / mover / leaver is the control most auditors test first and most companies fail quietly: an account that outlives its person.
- **Identify.** Mechanisms in harm sentences are usually people-shaped: "contractors work from personal devices"; "support staff hold privileged access to customer endpoints." You cannot write those sentences without knowing who the contractors are.
- **Govern.** Owners of risks, policies and controls are people on this roster. A decision owner who is not on it is not an owner.
- **Assure.** Policy acknowledgments, training completion, access reviews and device compliance are all per-person evidence. The denominator is this roster.

## Minimum fields (the floor)

| Field | Rule |
| --- | --- |
| `id` | stable slug; never reused |
| `name` | |
| `email` | primary; lowercase |
| `emails[]` | aliases, with `source` each — so an IdP account under an alias unifies onto the person instead of minting a duplicate |
| `status` | `coming` (pre-start) · `active` · `going` (departing) · `exists` (account kept without an attributed active person) · `gone` (offboarded) · `ignore` (not a managed identity) |
| `role` | `employee` · `contractor` · `vendor` · `service` |
| `idp_state` | as reported by the identity provider, with `idp` named |
| `start`, `end` | dates; `end` required when `going` or `gone` |
| provenance | `source`, `added`, `updated`, `updated_by` |

Aspirational, tick on when the company wants to drive them: `job_role`, `manager`, `department`, `location`, `device_primary` (→ devices), `training_learner_id`, `acknowledgments[]` (→ policies).

**Completeness is graded only for `coming | active | going`.** A `gone` person with no manager is not a gap.

## Acceptable sources and how each is used

| Source | Fills | Via | Notes |
| --- | --- | --- | --- |
| HRIS export | name, role, manager, start/end, department | CSV | authoritative for *should exist*; often the only source for contractors |
| Identity provider (Okta, JumpCloud, Google Workspace, Microsoft Entra) | email, aliases, idp_state, groups, last login | MCP / API | authoritative for *does exist*; one "lane" per provider, kept verbatim under `mirrors/` |
| MDM / RMM / EDR | device → owner hints | MCP / API | never creates people; proposes owner links for the steward to confirm |
| Training platform | learner → person by email | API / CSV | never creates people |
| Markdown | anything, for the smallest companies | `inventory/people/*.md` with frontmatter | the floor is a text file |

Rule of resolution: **the roster is the record; provider lanes are evidence about it.** When lanes disagree (HR says active, IdP says suspended), the disagreement is surfaced as a needs-action row; per-field precedence is a program rule (`rules/people.yaml`), with a framework default of HR for existence and dates, IdP for state.

## Joins

- Person **1:N** Devices (`devices[].owner`) — the primary device carries compliance.
- Person **1:N** Access grants (`access[].person`) — lifecycle dates are the review evidence.
- Person **N:M** IdP accounts — unified by lowercase email ∪ aliases.
- Person **1:1** Training learner — by email.
- Person **1:N** Policy acknowledgments.
- Person **←** Risks, decisions, controls, policies as `owner`.

## Freshness and attention

Freshness thresholds live in `sources.yaml` per source; framework defaults: IdP lane stale after 24 h, HRIS after 7 days, training after 30 days. A stale lane is itself a needs-action row ("sync may have stopped"), never silently trusted.

Attention policy (framework default, program-tunable; "what counts as actionable is policy, not vibes"):

| Row surfaces when | Why it's here | What fixes it |
| --- | --- | --- |
| `active` with no primary device | compliance has nowhere to ride | bind a device or mark `exists` |
| `gone` with any `idp_state` ≠ disabled | an account outlived its person | disable; record offboarding evidence |
| `going` past `end` + 30 days still enabled | "in-succession" grace exhausted — stops being an accepted exception and starts being a finding | hand over or disable |
| IdP account with no roster match | unknown identity | add as `exists`/`ignore`, or disable |
| `active` missing `email`, `role` or `idp_state` | floor not met | fill from a source |
| two people sharing an alias | duplicate | merge |

"If 40 of 58 people are problems, the feature is dead": defaults are set where the data actually is; a program whose roster is young runs with the floor only and turns on aspirational fields deliberately.

## Floor vs advancing

- **Floor (day one, any size):** every `coming | active | going` person has `email`, `role`, `idp_state`; one IdP lane connected or a CSV; offboarding recorded as `gone` with an `end` date.
- **Advancing:** manager and job role driven in; primary device bound for everyone; aliases reconciled across lanes; policy acknowledgments and training joined; per-field precedence rules written; JML stages *derived* from facts (never stored) and graded against the leaver clock.

## What this is not

Not an HR system of record (it reads one). Not an identity provider (it reconciles several). Not a place for secrets, salaries or performance data — the roster carries only what a control, a risk or an evidence item needs. Not a per-person league table: organizational values only; quality signals, never volume counts.

## Open items

1. Service accounts as roster rows vs a separate silo. *Lean:* roster rows with `role: service` and an `owner` person — an unowned service account is the finding.
2. Vendor staff with access: roster rows (`role: vendor`, `vendor` slug) or vendor-silo entries? *Lean:* roster rows, so access reviews have one denominator; the vendor silo links to them.
3. Default per-field precedence when HR and IdP disagree. *Lean:* HR for existence and dates, IdP for state; program overrides in `rules/people.yaml`.
