<!-- scope: steering · inventory · the agents silo: agent records and agent-connection records; why, minimum fields, sources, joins, freshness, attention. -->
# Agents — the actor roster and the living inventory of connections

**Status:** framework steering, working position 2026-10-05; from the author's position on agent identity and protection. Companions: `people.md` (the genre; owners live there), `systems`, `access`, `vendors` silos, `../house-rules/agent-trust-boundary.md` (the rules these records enforce), `../domains/ai-agents.md` (the doctrine). Schemas `inventory-agent` and `inventory-agent-connection` are an M1 deliverable.

## The desire, in the author's words

> "Define the actor, prove who is acting, and enforce what it can do. Keep those decisions independent of model instructions."

> "Agent → runtime → target system/resource scope → authentication mechanism → credential owner → effective access → enforcement point → secret location → expiry/revocation → authorized configuration owner."

## The strategy, in one paragraph

An agent is a logical principal: a durable record of an actor, its purpose, its owner and its authority. It is not an identity-provider user, though it may hold one; it is not a model, though it runs on one; it is not a prompt, though a prompt names it. The silo keeps two records: the **agent** (who this is, who owns it, how autonomous it may be) and one **agent-connection** per agent-to-system path (whose authority it uses there, what it can actually reach, what enforces that, how it is revoked). The connection chain is the unit of risk: an agent with three connections has three independently enforced boundaries or three independent holes. The inventory is kept aligned with real configuration by reconciliation, not by trust — a spreadsheet cannot enforce the intended state, so every declared fact is checked against what the identity provider, the gateway and the target's own admin surface report.

## What this silo is

One `agent` record per logical non-human actor the company is accountable for: the harness's own personas and sub-agents, workflow automations, assistants embedded in vendor products, scripts with their own credentials. One `agent-connection` record per path from an agent to a target system. Not the identity provider's service-account list. Not the gateway's config. The *reconciled* answer across all of them.

## Why it matters to a risk-based program

- **Identify.** "What can it actually do?" has one answer only when every path is recorded — direct credentials and embedded capabilities included. A gateway protects only the access that must pass through it.
- **Protect.** The connection record is where scope, duration, enforcement point and revocation are declared; the trust-boundary rules (`../house-rules/agent-trust-boundary.md`) are enforced against these fields.
- **Govern.** Every agent has an owner on the people roster; every authority change has an authorized configuration owner. Autonomy tier is a decision with a human name on it.
- **Assure.** "% of agents with scoped identity, logging and a kill switch" (`../program/ai-first-operating-model.md`) has this silo as its denominator.

## Three layers one record must answer

| Layer | Question | Field(s) |
| --- | --- | --- |
| Defined identity | Who is this agent? | `agent.id`, `purpose`, `owner`, `expected_behavior`, `autonomy`, `lifecycle` |
| Operating identity | How do we prove this request came from that agent? | `connection.authentication` — a runtime or session credential bound to the agent; a name in a prompt is insufficient |
| Authorized identity | Whose authority does it use in each system? | `connection.mechanism`, `credential_owner` |

**Effective access** is tracked separately from all three: what the agent can read or change after every credential, platform permission, gateway rule and alternate path is considered. One logical agent may hold several external identities; the agent record survives a model or runtime change, and any new runtime must be explicitly authorized to act for it (a new connection record, through the human gate).

## Minimum fields — `agent` (the floor)

| Field | Rule |
| --- | --- |
| `id` | stable slug; never reused; survives model and runtime changes |
| `purpose` | one sentence; the task boundary |
| `owner` | → `people`; a human; an unowned agent is the finding |
| `expected_behavior` | what it does, what it never does, its stopping condition |
| `autonomy` | `human-in-the-loop` · `delegated` (within declared limits) · `autonomous`; see the ladder in `../domains/ai-agents.md` |
| `lifecycle` | `proposed` · `pilot` · `active` · `suspended` · `retired`; retire, never delete |
| `runtime` | → `systems`; the platform or environment that operates it |
| `model` | informational; a change here never changes authority |
| provenance | `source`, `added`, `updated`, `updated_by` |

## Minimum fields — `agent-connection` (the chain)

| Field | Rule |
| --- | --- |
| `id` | stable slug |
| `agent` | → `agent` |
| `runtime` | → `systems`; the environment this path runs from |
| `target` | → `systems`; plus `resource_scope` (tenant, project, bucket, channel, repository — the concrete boundary) |
| `mechanism` | `oauth-delegated` · `service-account` · `api-key` · `pat` · `bot-token` · `idp-user` · `embedded` (vendor assistant; the company does not control every path) |
| `credential_owner` | → `people` (delegated human) or → `agent` (its own identity); for `oauth-delegated` record the person, the scopes, and what happens on revocation or account change |
| `declared_access` | the operations and data the connection is meant to allow |
| `effective_access` | what it can actually do through this path, as observed; see freshness |
| `enforcement_point` | `gateway` · `destination-native` · `both` · `none` — `none` is a finding |
| `secret_location` | **name and location only** (a password manager item, a vault path, an env var name); never the value |
| `expiry`, `revocation_path` | when it dies on its own; how a human kills it, including active sessions |
| `kill_switch_tested` | date; required before any connection that writes goes `active` |
| `authorized_config_owner` | → `people`; who may add a credential, reconnect, widen a scope or enable a tool on this path |
| `risk_rationale` | the residual that could not be constrained, and the decision that accepted it (→ `decisions`) |
| provenance | `source`, `added`, `updated`, `updated_by` |

Mechanisms are not interchangeable; the field records which one so the risk can be read. A unique API key does not mean limited access; OAuth is not inherently human delegation; an IdP user is a compatibility choice, not the definition of an agent. Prefer narrow access, clear ownership, short lifetimes and reliable revocation; choose on enforceable capability, never on the assumption that one mechanism is always safer.

**Completeness is graded only for `pilot | active`.** A `retired` agent with no `kill_switch_tested` is not a gap; a `retired` agent with a live connection is.

## Acceptable sources and how each is used

| Source | Fills | Via | Notes |
| --- | --- | --- | --- |
| Identity provider | service accounts, bot users, IdP-user mechanisms, state, last use | MCP / API | authoritative for *does exist* under that mechanism; one lane per provider under `mirrors/` |
| OAuth grant logs (workspace, SaaS admin) | delegated grants: person, app, scopes, date | API / export | the only source for `oauth-delegated` consequences; a grant with no connection record is unknown authority |
| Gateway / agent platform | agents registered, tools enabled, policies, sessions | API | authoritative for *enforcement point = gateway* paths and nothing else |
| Target systems' admin consoles | keys, tokens, bots, installed apps, roles | API / export | authoritative for *effective access* on that target; never creates agents |
| Secret store (names only) | `secret_location`, expiry | API (metadata) | reads item names and ages, never values |
| Vendor records | embedded assistants and their declared capabilities | `vendors` silo | fills `mechanism: embedded`; the vendor's enforcement is a premise on the connection's decision |
| Markdown | anything, for the smallest programs | `inventory/agents/*.md` with frontmatter | the floor is a text file |

Rule of resolution: **the agent record is the actor; every lane is evidence about one of its paths.** A lane that shows a credential with no connection record is a needs-action row, never silently adopted.

## Joins

- Agent **1:N** Connections.
- Agent `owner` **→** People; Connection `credential_owner`, `authorized_config_owner` **→** People (or → Agent for self-owned identities).
- Connection `runtime`, `target` **→** Systems.
- Connection **→** Access (each connection is an access grant with a non-human principal; access reviews share one denominator).
- Connection `mechanism: embedded` **→** Vendors.
- Connection `risk_rationale` **→** Decisions; the connection's facts are `inventory-fact` premises (`../risk-core/premises.md`) — a widened scope re-opens the decision.
- Agent **←** Findings, scenarios, review records as `actor`.

## Freshness and the effective-access reconciliation

Framework defaults, program-tunable in `sources.yaml`: IdP and gateway lanes stale after 24 h; OAuth grant logs after 7 days; target admin consoles after 7 days; secret-store metadata after 24 h. A stale lane is itself a needs-action row.

**Reconciliation runs declared against observed, through every path.** For each `active` connection the engine compares `declared_access` with `effective_access` as the target reports it; for each agent it compares the set of declared connections with the set of credentials, grants and installed apps the lanes attribute to it. Wider than declared, or a path the record does not know, is the finding — not the agent's behavior.

Attention policy (framework default):

| Row surfaces when | Why it's here | What fixes it |
| --- | --- | --- |
| connection with no `credential_owner` or agent with no `owner` | authority nobody answers for | assign, or revoke |
| authority changed outside the inventory (lane shows a new grant, key, tool or scope with no connection record or no change through the gate) | rule 6: an access change bypassed the owner | record it through the gate, or revoke it |
| credential past `expiry` and still usable | identity acting after trust ended | rotate or revoke; record |
| agent whose `runtime` lost its authorization (runtime retired, failed its controls, or de-listed) while connections remain `active` | an approved path became unapproved underneath the agent | suspend the agent; re-authorize or retire each connection |
| `effective_access` wider than `declared_access` | the boundary is not what the decision assumed; `premise-moved` fires | narrow at the destination, or re-decide |
| `enforcement_point: none` on an `active` connection | nothing survives the agent ignoring its instructions | add a gateway or native scope; until then `human-in-the-loop` only |
| connection that writes with no `kill_switch_tested` or past its threshold | revocation is a claim, not a fact | run the test; record the date |
| `retired` agent with any connection not revoked | an actor outlived its purpose | revoke; record |

## Floor vs advancing

- **Floor (day one, any size):** every `pilot | active` agent has `owner`, `purpose`, `autonomy`, `runtime`; every connection has `mechanism`, `credential_owner`, `enforcement_point`, `secret_location` (name), `revocation_path`; one IdP or gateway lane, or a Markdown file.
- **Advancing:** `effective_access` observed per target on cadence; OAuth grant logs joined; `kill_switch_tested` on every writing connection; `risk_rationale` linked to a decision with premises; attribution end-to-end (downstream logs showing a human or shared account resolve to the authenticated agent, the authorizing person and the credential used).

## What this is not

Not the identity provider's list of service accounts — that is one lane. Not the gateway's registry — a gateway sees only what passes through it. Not a place for secret values; names and locations only. Not a model inventory — which model an agent runs on is informational here; the authority does not move with it.

## Open items

1. The two JSON Schemas, `inventory-agent` and `inventory-agent-connection`, with the enums above, are an **M1 deliverable** alongside the other silo schemas; nothing is written now. *Lean:* `agent-connection` extends the `access` shape with a non-human principal rather than duplicating it.
2. Whether the harness's own personas are rows in the program's agents silo or only in the framework's. *Lean:* rows in the program's silo, so a program's "% of agents with a kill switch" counts Satoru too.
3. How `effective_access` is represented for an `embedded` mechanism the company cannot observe. *Lean:* `unobservable`, which forces the row into the decision with the vendor's attestation as an `external` premise.
