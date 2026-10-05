<!-- scope: steering · domains · AI agents: the harms this domain prevents, its ask → risk table, breakdown prompts, coverage expectations, and the autonomy ladder. -->
# AI agents — control doctrine for the agents a program governs

**Status:** framework steering, working position 2026-10-05; the first domain file, from the author's positions on agent identity and on security for an AI-first company. Companions: `../risk-core/harms.md`, `../risk-core/intermediate-vocabulary.md`, `../risk-core/intake-reflex.md`, `../house-rules/agent-trust-boundary.md` (the same rules applied to the harness itself), `../inventory/agents.md` (the silo these controls read), `../program/ai-first-operating-model.md`.

Scope: every non-human actor the company is accountable for — in-house agents, workflow automations, assistants embedded in vendor products, scripts with credentials. Coverage expectations here become `coverage/ai-agents.yaml` at M3; the Control Compiler grounds each control in the agents silo, never in tools the company does not have.

## The harms this domain exists to prevent (the tree's upward edge)

| Intermediate harm | How an agent produces it | Root |
| --- | --- | --- |
| `credentials-secrets-compromised` | an agent, its tools or its execution environment can retrieve or expose a raw credential; a secret pasted into context | H1 |
| `data-leaves-control` | read access wider than the task; retrieved material sent to a model, a vendor or a channel the company does not govern | H1, H6 |
| `unauthorized-undetected-change` | an agent acts outside its delegated boundary on a target with no enforcement at the destination; the change is logged, not prevented | H1, H2 |
| `identity-acts-after-trust-ended` | a credential outlives the pilot, the person who delegated it, or the runtime's authorization | H1 |
| `third-party-compromise-reaches-us` | an embedded assistant, a model provider or a connector vendor is compromised and holds a path into the company's systems | H1, H2 |

Every control compiled in this domain declares `prevents[]` from this table, so it is born wired to a root.

## Ask → risk table (what the Intake Reflex reads)

The person has a response, not a risk. Fire back once, then propose candidate branches already placed on the tree, narrowed by what the agents silo shows.

| The ask | Candidate branch (the mechanism) | Intermediate harm | Root | What actually treats it |
| --- | --- | --- | --- | --- |
| "We'll give the agent an IdP user" | the account has a human's default group memberships and every app the IdP federates; nobody owns its lifecycle | `identity-acts-after-trust-ended`; `data-leaves-control` | H1 | an `agent` record with an owner; a connection per target with declared scope; destination-native least privilege; expiry on the credential. The IdP user is one mechanism, not the identity |
| "We'll use the vendor's embedded assistant" | the vendor's enforcement is the only boundary; the assistant reads everything the tenant holds; the company controls no action path | `third-party-compromise-reaches-us`; `data-leaves-control` | H1, H2 | `mechanism: embedded` connection with the vendor's attestation as an `external` premise; restrict what the tenant exposes; a decision that names the residual and its owner |
| "We'll let it run autonomously" | the delegated boundary is the prompt; no gate enforces target and action before execution | `unauthorized-undetected-change` | H1 | the autonomy ladder below: `autonomous` only after denied actions, isolation, configuration restrictions and shutdown are verified; limits on environment, spend, volume and destructive actions enforced in tooling |
| "We'll switch models" | authority was bound to the runtime, not the agent; the new runtime inherits credentials nobody re-authorized | `identity-acts-after-trust-ended` | H1 | identity survives the model; a new runtime is a new connection through the gate; `agent.model` is informational. Usually "go, with these defaults" — a model change is a control-implementation question, not a disposition |
| "We'll add a connector" | an access change dressed as configuration; a direct path that bypasses the gateway | `unauthorized-undetected-change`; `data-leaves-control` | H1 | rule 6 (`agent-trust-boundary.md`): connector = connection record with `authorized_config_owner`; effective access reconciled after it lands |
| "We'll put the secret in the agent platform's vault" | the vault protects storage; the execution environment can still read the value and the agent can still exercise the credential's full authority | `credentials-secrets-compromised` | H1 | authorize the operation, never hand the secret: a broker or the adapter runtime uses it; scope, duration and revocation on the connection; `secret_location` by name |
| "We'll log everything" | Detect, post-compromise: recording that the agent deleted the record does not protect the record; logs carry the data they were meant to protect | `unauthorized-undetected-change` (unchanged); `data-leaves-control` (new, from the logs) | H1, H6 | place the log where it sits, blind spots written down; Protect first — scope at the destination, approval before execution; logs without secrets or payloads |
| "We'll pilot one agent" | the right first move, with one branch nobody names: the pilot's credentials, data and tools outlive the pilot | `identity-acts-after-trust-ended` | H1 | `lifecycle: pilot` with an end date; narrow purpose, limited data, limited actions; verify denied actions, isolation, configuration restrictions and shutdown before `active`; the kill switch tested on the way in, not on the way out |

Each candidate arrives with an illustration (`../risk-core/illustration.md`) and one disposition per branch, owned outside security.

## Breakdown prompts — the ten questions before granting authority

The assessor asks these of every agent in the breakdown; an answer of "the prompt says" is recorded as a gap.

| # | Question | Record that answers it |
| --- | --- | --- |
| 1 | **Who is the agent?** Persistent logical identity, purpose, owner | `agent.id`, `purpose`, `owner` |
| 2 | **Where does it run?** Does the runtime meet the required controls | `agent.runtime` → `systems`, its control state |
| 3 | **How does it prove its identity?** What authenticates its requests beyond a name in its instructions | `connection.authentication` |
| 4 | **Whose authority does it use?** Own identity, a human's delegation, a shared credential; what happens when that identity changes or loses access | `connection.mechanism`, `credential_owner` |
| 5 | **What can it actually do?** Every system, data, resource, tenant and action through every path | `effective_access` across all connections |
| 6 | **What enforces those limits?** If it ignores its instructions, what prevents the bad action; can it bypass the gateway | `enforcement_point`; the trust-boundary rules |
| 7 | **Who can change its authority?** Reconnect an account, add a key, enable a tool | `authorized_config_owner`; the access-change gate |
| 8 | **Can we revoke it completely?** Execution stopped and access removed across every connection, including active sessions | `revocation_path`, `kill_switch_tested` |
| 9 | **Can we attribute its actions?** The authenticated agent distinguished from the person or account whose credential it used | attribution join: downstream log → agent, authorizing person, credential |
| 10 | **What risk remains?** What cannot be constrained, who owns it, do they accept it | `risk_rationale` → a decision with an owner outside security |

## Coverage expectations (what a complete domain addresses)

Six capabilities from the blueprint's AI control set. Each becomes a row in `coverage/ai-agents.yaml` with the maturity at which it is expected.

| Capability | What it covers | Harms it treats |
| --- | --- | --- |
| **AI development security** | models, prompts, retrieval corpora and agent code treated as software: versioned, reviewed, tested, with a curated knowledge base whose sources are authoritative and whose exploratory findings are kept distinct from accepted facts | `unauthorized-undetected-change`, `data-leaves-control` |
| **External model governance** | which model providers and embedded assistants are approved, what data may reach them, under which terms, with vendor enforcement recorded as a premise | `third-party-compromise-reaches-us`, `data-leaves-control` |
| **Agentic AI security** | scoped identity per agent, least-privilege scopes per connection, approval before consequential execution, a tested kill switch, attribution end to end | `credentials-secrets-compromised`, `unauthorized-undetected-change`, `identity-acts-after-trust-ended` |
| **AI integration infrastructure** | the fabric: the approved runtime and gateway, the credential broker, the connector admission path; direct credentials and alternate routes inventoried, not assumed away | `credentials-secrets-compromised`, `unauthorized-undetected-change` |
| **Rapid-development security** | secure defaults inside the tooling developers and agents already use, so the safe path is the easy path; the intake that answers in days with "go, with these defaults" | `unauthorized-undetected-change`, `data-leaves-control` |
| **AI-assisted testing** | agents verifying denied actions, isolation, configuration restrictions and shutdown on cadence, producing evidence; detection sized to the highest-impact paths | all five, as assurance; it treats none on its own |

## The autonomy ladder (what has to be true before an agent acts alone)

Each step is a gate on `agent.autonomy`; the preconditions are checked against records, not asserted in prose. A step down is immediate; a step up is a decision.

| Step | The agent may | Gate to enter (all required) |
| --- | --- | --- |
| **Human-in-the-loop** | explore, analyze, recommend; execute only what a human approves per action | `agent` record complete to the floor; `owner`; every connection has `mechanism`, `credential_owner`, `secret_location` by name; `enforcement_point ≠ none` |
| **Delegated within limits** | execute routine operations without per-action approval inside a declared boundary; return to a human when uncertainty exceeds it | the boundary is written as `declared_access` and enforced at the destination; limits on environment, spend, volume and destructive actions enforced in tooling; consequential actions still gated on concrete target and action; `revocation_path` exists; denied actions and tenant isolation verified and recorded as evidence |
| **Autonomous** | run to a stopping condition without a human on the path | everything above, plus: `kill_switch_tested` within threshold; `effective_access` reconciled and equal to declared across every path; attribution demonstrated end to end; the residual recorded as a decision with an owner outside security; detection sized to the paths that matter; the pilot's end date passed with its evidence |

The scaffolding is the point: what has to be true before an agent acts alone is written down here and enforced in tooling, so moving up the ladder is a records check, not a meeting.

## What this is not

Not a model-safety or prompt-engineering guide — it bounds what an agent can reach, not what it says. Not a list of approved vendors — those are decisions in the program. Not a reason to withhold autonomy — delegated execution within enforced limits is the goal; the ladder exists so the step up is legible and reversible. Not the harness's own boundary — that is `../house-rules/agent-trust-boundary.md`, which these controls mirror.

## Open items

1. Standing conditions typical at 50–500, Baseline vs Advancing per capability, over-commitment traps and the maturity level names: written with the author at M3 alongside `coverage/ai-agents.yaml`.
2. Where this domain sits in the canonical taxonomy (D5): its own domain, or capabilities inside Identity & Access and Vendor Management. *Lean:* its own, because the autonomy ladder has no home elsewhere.
3. Whether "AI-assisted testing" is a capability here or an evidence-design pattern that every domain uses. *Lean:* keep it here for the first lap; promote it when a second domain needs it.
