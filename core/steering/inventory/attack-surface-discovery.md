<!-- scope: steering · inventory · RESERVED capability (post-M5 upgrade), documented now as a must-have. Defensive external attack-surface discovery of the customer's OWN estate, feeding inventory reconciliation and the risk tree. -->
# External attack-surface discovery — mapping the estate you forgot you had

**Status:** framework steering, **RESERVED** — a planned upgrade to the stack, not in the M0–M5 build. Documented here as a near-term must-have so the inventory model is designed to receive it. Becomes `steering/inventory/attack-surface-discovery.md` and, when built, a **recon adapter class** (`adapters/`) plus a `discover` scope. Companions: `steering/inventory/README.md` (entity-centric; "link, don't merge"; "no source, no fact"), `steering/risk-core/` (orphan-node; placement first), Addendum B §2 (source license classes).

## The desire, in the author's words

> I was looking at an OSINT harness and the website around it. The product is trash, but the concept is not. We need some mapping to aid the inventory — recon capability that can go into the directories of an estate and tell you what's actually there. I already built my own tools for this; I just need to translate them into build files. Reserve it as an upgrade, but document it as a must-have soon.

## The strategy, in one paragraph

Most inventory failures are not bad data — they are **missing rows**. The company knows about the systems it provisioned on purpose; it does not know about the subdomain a contractor stood up in 2023, the SSO tenant spun up for a pilot, the storage bucket a deploy script created, or the marketing site running an unpatched CMS nobody claims. External attack-surface discovery is the sanctioned, outside-in sweep of the company's **own** footprint that finds those rows and hands them to reconciliation. It is a *source* in the exact sense the inventory model already uses: it produces evidence about entities, mirrored verbatim, never merged, always provenance-stamped. Its special value is that it is the one source that can tell you about an asset **no internal system has a record of** — and in this framework, a discovered-but-unmanaged asset is not a curiosity, it is an **orphan node**: a thing with external exposure that backs out to no owner, no control, and therefore no decided risk. That is the finding. The sweep exists to generate it.

## What it is for (and what, in this framework, it produces)

The sweep never ends at "here is a list of your stuff." Every discovered entity is routed to the inventory silo it belongs to and carried up the tree:

| Discovery category | Inventory silo it feeds | The signal that matters here |
| --- | --- | --- |
| **Domain & DNS footprint** — the company's registered domains, resolving subdomains, and the records (certificate-transparency logs, passive DNS) that reveal names never published | `systems/`, `data-stores/` | a resolving host with no system record is an orphan node; its exposure backs out to a harm before anyone has decided to carry it |
| **Public web & API surface** — which of those hosts answer, what they are (app, login, admin, API, dev/stage left public), and whether the basics hold (TLS, security headers) | `systems/` | a login or API the inventory doesn't list is unmanaged access to something; a stage/admin surface left public is a governance gap, not a scanner ticket |
| **Identity & SSO footprint** — which identity provider(s) the company's domains actually use, and whether more than one tenant exists than the roster knows | `access/`, `vendors/` | a second IdP tenant or an unsanctioned SSO integration is shadow identity — it widens the "identity keeps acting after trust ended" intermediate harm |
| **Cloud & hosting footprint** — the cloud accounts, hosting providers and edge services the estate actually resolves to | `systems/`, `vendors/` | an account or provider not in `vendors/` is third-party exposure with no oversight control |
| **Public code & exposure** — the company's own public repositories and published artifacts, checked for the company's own secrets and internal references having leaked out | `data-stores/`, `findings/` | a leaked credential or internal reference is a *finding* about a control (secrets handling), linked to the control, never a register row of its own |

Each lands as a **mirror** under `mirrors/<recon-source>/<date>/`, verbatim, then resolves into candidate inventory rows that reconciliation adjudicates against the authoritative silos. "No source, no fact" holds without change: a recon observation is a source like any other, with a date and a freshness clock, and it decays (90-day re-validation, per the oDeshi facts-decay rule).

## The guardrails — non-negotiable, and the reason this is reserved, not rushed

This capability points sensing tools at infrastructure. In this framework it is bounded the way every other powerful thing is — by authorization, scope, and the human gate — and those bounds are **preconditions of the scope running at all**, enforced in the adapter descriptor, not advice in prose:

1. **Own estate only, and only with authorization on record.** The `discover` scope refuses to run without a recorded **authorization** artifact: the human-approved scope of domains, IP ranges, cloud accounts and identity domains the company attests it owns or operates, with the authorizing person named (`authorized` set only by a human action, per the human-gate rules). Anything outside that declared scope is out of bounds; the sweep does not wander. This is the same discipline the field guide applies to monitoring: it is sized and scoped to a decision, never open-ended.
2. **Passive first; active only inside scope, and recorded.** The default and the bulk of the value is passive — public records, certificate transparency, DNS, what hosts voluntarily return. Any active touch is confined to the authorized scope, rate-limited, logged to the audit shard, and defaults off until a human turns it on for that run.
3. **Discovery of the company's own exposure — never enumeration of people or third parties.** The sweep maps *assets and their configuration*. It is explicitly **not** a toolkit for enumerating user accounts, for credential or session attacks, for social-engineering or phishing-style probes, or for touching any party other than the customer's own authorized estate. Those are out of scope by design; the adapter class does not carry them and the steering does not describe them. This framework builds **defensive** programs — the recon exists to find your own unmanaged exposure and decide the risk, full stop.
4. **Findings, not risks.** Everything the sweep finds enters as inventory candidates or as `findings` linked to controls. A discovered weakness is a finding about a control that is not holding; the *risk* is the harm the control exists to prevent, and it is almost always already a node on the tree. The Intake Reflex applies: a sweep result that arrives shaped as "we found X, go fix it" is walked back to the parent risk before anything is decided.
5. **The sweep itself is a recorded decision.** Standing up an outside-in discovery capability — especially one that touches the estate actively — is a **Transfer/accept-of-exposure** decision with an owner and a review date, the same way a deep compliance-platform integration is (field guide §12; compliance-automation steering). You do not quietly acquire the ability to scan everything you own; you decide to, and you write it down.

## How it lands in the harness (when built)

- **A recon adapter class** in `adapters/`, descriptors declaring *reads* only (public records, authorized active probes → mirrors), never a write to authored content — identical boundary to the compliance-platform `ca-write-boundary`.
- **A `discover` scope** gated on the authorization artifact (precondition), producing mirrors → reconciliation candidates → orphan-node findings, then handing straight to the normal `reconcile` and `breakdown` stages. Nothing it produces reaches a silo ungated.
- **The author's existing tools become build files, not a bundled scanner.** The author's own tooling is translated into adapter descriptors (what each tool observes, how its output maps to silos and the tree) and, where a capability has no external tool, a thin reader. The heavy external tools stay external and pinned; core carries the *descriptors and the mapping doctrine*, never a vendored offensive toolkit. The private overlay may point at the author's tools; core ships the generic shape.
- **New sensor:** `shadow-asset` — a reconciled entity present only in a recon mirror, with no authoritative source and no owner, surfaced with its reason (externally exposed) and its fix (claim-or-decommission), attention-first.

## What this is not

Not a threat-intelligence feed, a dark-web-monitoring product, or a SOC — the vendor framing that prompted this is exactly what the framework steers away from (the compliance-automation "Instagram of your life" caution applies: a threat dashboard is a snapshot someone else curated). Not continuous offensive testing or a penetration-testing replacement — those are scoped engagements with their own authorization. Not a capability that touches anything the company does not own and has not authorized in writing. Not an inventory *replacement* — it is one more source feeding reconciliation, and the authoritative silos still decide what is true.

## Open items

1. **DECIDED 2026-10-03 (author):** reserved as a post-M5 upgrade; documented now so the inventory and reconciliation model is built to receive a recon source without rework. The `shadow-asset` sensor and the mirror/provenance path are designed in at M1 even though the recon source itself is not built.
2. Which of the author's existing tools translate to descriptors first (lean: domain/DNS and public web surface — highest shadow-asset yield, fully passive); and which capabilities are passive-only vs. authorized-active.
3. The authorization-artifact schema (owned domains, IP ranges, cloud accounts, identity domains; authorizer; expiry) — likely an extension of the `sources` registry rather than a new record type.
4. Whether `discover` is a core scope with a generic descriptor set, or ships in a plugin with the author's tools behind the private overlay. Lean: generic descriptors + `shadow-asset` sensor in core; the author's specific tooling in the overlay.
