<!-- scope: steering · compliance · compliance automation and trust centers as the bridge, never the system of record. -->
# Compliance automation and trust centers — the bridge, not the building

**Status:** framework steering, working position 2026-10-02, from the author's operating opinion; becomes `steering/compliance/compliance-automation.md`. Companion: Addendum A (obligations, Why gate), Addendum B §2 (license classes; adapter contract), `steering/inventory/` (mirrors are temporary; link, don't merge).

## The desire, in the author's words

> We do compliance automation, trust center, and the complement of tools to simplify and expedite this stuff. It's the bridge between the org and the auditors. We steer away from it being the source of truth, or even a store for everything. This happens a lot — they think Vanta is the system of record. No. Vanta sees an edited picture of reality. It's the Instagram of your life. The real life happens elsewhere. You need your own platform and systems for that. Vanta is a snapshot.

## The strategy, in one paragraph

Use the platforms, and use them hard, for what they are built for: collecting evidence on a schedule, presenting it to an auditor in the shape the auditor expects, tracking acknowledgments, and — through a trust center — showing prospects a curated, current picture of the program. Keep real life somewhere you own: the program repository, where inventory, risks, decisions, tolerances, controls, policies and evidence requirements live and change. Publish *from* the program *to* the platform on a cadence, with provenance, so the snapshot is always a known age and a known derivation. Read *from* the platform only what it uniquely knows — its monitors' results, filing status, who acknowledged what — and treat those as findings and events, never as records. The failure mode is not buying a platform; it is running the business from the photograph.

## What the platform is for (and the harness steers customers toward it)

| Job | Platform does it well | Program's role |
| --- | --- | --- |
| Evidence collection on cadence | integrations pull configuration states, screenshots, lists | names the requirement (by evidence *name*), the producing task, the frequency; the platform fills the slot |
| Auditor surface | the auditor reads here; request lists, sampling, population pulls | compiles the system description, control matrix and policy set and publishes them; the auditor sees the picture, the program holds the negatives |
| Acknowledgments and training tracking | policy sign-off, security awareness completions | treats completions as events joined to people; the roster stays the denominator |
| Drift monitors | "MFA disabled on X," "disk encryption off on Y" | imports as `finding` with `exploitable: undetermined`, linked to the control it tests; never a risk, never a control |
| Trust center | public posture, downloadable report under NDA, questionnaire answers, subprocessor list | a compiled view, published deliberately; every fact on it traces to a program record |
| Vendor questionnaire inbound/outbound | templates, answer libraries | answers come from the fact store ("no source, no fact"); the platform is the mailbox |

## What the platform is not (and the harness refuses to let it become)

- **Not the system of record.** Nothing authored lives there first. Controls, risks, decisions, tolerances, policies and obligations are written in the program and *published*. A control written in the platform's words is a draft until it is re-shaped and justified in the program.
- **Not a store for everything.** The inventory of people, devices, systems, vendors and data stores is the program's, fed by the program's own sources. The platform's integrations are one more lane of evidence about those entities — "tool views are evidence about an entity, not the entity."
- **Not the register.** Its risk module holds a copy of decisions already made, or nothing. "Treatment decisions stay in the platform" is the failure mode by name.
- **Not the catalogue.** Its control library is a *control source* (Addendum B §2): a seed to be mapped to coverage and re-shaped, never the program.
- **Not posture.** Green is the state of the monitors it can see, on the day it looked. "We are secure because we bought it" and "it told us to" are anti-patterns with their own names (Addendum A).
- **Not the authority on what the auditor will accept.** That is the auditor's judgment within the criteria (Addendum B §1.3); the platform's template is not a criterion.

## The snapshot principle — three rules

1. **Published, not synced.** Everything that reaches the platform or the trust center is a *compiled view* from program records, carrying a run id, a hash, and the date. The direction is one-way for authored content; the adapter descriptor enforces it (`ca-write-boundary`: the platform never writes to `controls/`, `risks/`, `decisions/`, `tolerances/`, `policies/`, `obligations/`).
2. **The picture has a date.** The program always knows what changed since the last publication. "Vanta says green" is evaluated against the program's current state, never the other way round. A sensor (`snapshot-age`) surfaces a stale picture as a needs-action row with the publish task as the fix.
3. **Edited is fine; staged is not.** Curation is the point — show the auditor what is relevant, show prospects what is safe. What is never fine: closing a monitor to make the dashboard green instead of changing the thing it measured; writing a control to match a template rather than what the company does; letting the platform's policy set define the program's. The sensor for the first is the finding re-opening when the underlying state has not changed (`finding-closed-without-state-change`).

## Buying one is a decision, recorded

A platform integrated into every cloud account, identity provider and HR system is a vendor with visibility into everything the company runs. The program records the purchase as a **Transfer-of-exposure** decision with a vendor-management owner, a review date, and the data-access facts in `vendors/` — the same way it treats any privileged third party (field guide §12; Addendum A). The trust center is a second decision: what the company chooses to make public, by whom, reviewed when.

## Where this lands in the harness

- **Adapter descriptors** for compliance platforms declare two directions explicitly: *reads* (monitor results → findings; filing status → evidence; acknowledgments → events) and *publishes* (compiled views → the platform's shapes). No descriptor declares a read of authored content.
- **A publish task** per target (platform, trust center) on the program's cadence — the photo shoot — with the compiled artifacts from Addendum B §5 as its payload.
- **The trust center as a view**: `rbc/views/trust-center/` compiled from obligations (what we have committed), controls (what we do), the current report metadata, the subprocessor list from `vendors/`, and questionnaire answers from the fact store; every line with provenance; published deliberately, never auto.
- **Advisor vocabulary**: "the platform shows," "the program knows," "the business decides." It never says the platform *is* anything the program holds.

## What this is not

Not a recommendation against compliance automation or trust centers — the author sells and runs them. Not a sync engine or a second copy of the platform's data. Not a claim that auditors should read git; they read the bridge, and the bridge is honest because it is derived.

## Open items

1. Which compliance platforms get first-class descriptors in core (read + publish shapes) vs. a generic CSV/API descriptor; and whether the trust-center publish is a core adapter or a plugin.
2. Whether the publish task should refuse when any compiled artifact has unvalidated crosswalk rows (`mapping_status ≠ validated`) — lean: refuse for the auditor surface, warn for the trust center.
3. The minimum provenance a trust-center line must carry publicly (run date and report period only; never internal ids).
