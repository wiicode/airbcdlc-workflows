<!-- scope: steering · house-rules · how the harness's own agents are bounded: authority lives outside the prompt. -->
# Agent trust boundary — what holds when the agent ignores its instructions

**Status:** framework steering, working position 2026-10-05; from the author's position on agent identity and protection. Companions: `voice.md` (names, not values; the human gate), `../risk-core/intake-reflex.md` (dedupe), `../risk-core/premises.md`, `../inventory/agents.md` (the silo this file's rules are recorded in), `../domains/ai-agents.md` (the domain doctrine).

Scope: the harness's **own** actors — Satoru, the personas, sub-agents, any adapter that reads or writes on their behalf. The same rules apply to the agents a program governs; that is `../domains/ai-agents.md`. Different environments may place the enforcement point differently; the deciding question does not move.

## The deciding question

> **If the agent completely ignores its instructions, what prevents the bad action?**

Every rule below is an answer to that question. A rule whose only answer is "the prompt says not to" is not a control; it is a wish. Steering, personas, overrides and skills are *instructions*. Nothing in this file is satisfied by text an agent reads.

## Three operating principles

| Principle | Rule | Mechanism in the harness |
| --- | --- | --- |
| **Keep your secrets close** | Authorize the operation; never hand the secret. `Agent requests an operation → trusted component authorizes it → component uses the secret → agent receives the result.` | Adapter descriptors name the secret by **name and location** (a password manager item, a vault path, an environment variable name); the adapter runtime resolves it; no secret value enters a prompt, a record, a mirror or a log (`voice.md` names-not-values). A vault protects storage; it does not limit what a credential can do — scope, duration and revocation are declared on the connection record (`../inventory/agents.md`). |
| **Humans own decisions and outcomes** | Agents explore, analyze, recommend and execute within delegated limits. A human decides which operations run autonomously, under what conditions, and where approval is required; for consequential actions the approval names the concrete target and action and is enforced *before* execution. | The human gate: `authorized` is set only by a human action; nothing agent-authored reaches a record ungated; when uncertainty exceeds the delegated boundary the agent surfaces, it does not mutate. |
| **Humans curate the knowledge agents work from** | Exploration is candidate evidence until a human has assessed it. More retrieved material is not better knowledge; a narrow lead fixated on produces a convincing answer from an unbalanced context. | A sub-agent's discovery enters as a `scenario` or a `finding`, never as an inventory fact or a decision premise, until a human accepts it. The Intake Reflex dedupe step joins it to an existing node rather than minting a second; `premises.md` records only accepted facts as grounds. Every task carries a boundary and a stopping condition (`voice.md` bounded effort). |

## Seven rules that survive the agent ignoring its instructions

| # | Rule | Where it is enforced | Record or sensor |
| --- | --- | --- | --- |
| 1 | **Authenticate the calling agent independently of its prompt or self-reported name.** A persona slug in a prompt proves nothing. | Runtime or session credential bound to the agent; the adapter checks it | `agent-connection.authentication` (`../inventory/agents.md`); `provenance.updated_by` is set from the authenticated identity, not from text |
| 2 | **Enforce allowed operations and resource, tenant and environment boundaries at the gateway and the destination.** Validate target and parameters, not just the tool name. | Adapter descriptor declares `reads` and `publishes` per target; the destination's native permissions reinforce it | `ca-write-boundary` pattern (`../compliance/compliance-automation.md`): no adapter writes to `controls/`, `risks/`, `decisions/`, `tolerances/`, `policies/`, `obligations/` |
| 3 | **Keep service credentials outside the agent's reach; authorize operations through a trusted component.** | Credential broker or the adapter runtime; never the model's context or a tool result | Secret referenced by name; `secret_location` on the connection record; leak-test on shipped core |
| 4 | **Limit data exposure, not only changes.** Read-only access still exposes sensitive data. | Adapter `reads` scoped to the silo and fields a stage needs | `effective_access` on the connection record, reconciled against declared |
| 5 | **Cap environments, spending, volume and destructive actions; required human approval is enforced before execution.** | Gate on the stage graph; adapter refuses outside its declared scope | Review record at the gate; `decision.approved_by` is a human |
| 6 | **Separate authority changes from configuration changes.** Editing instructions must not grant access. Adding a credential, reconnecting an account, enabling a connector or tool, widening a scope is an **access change** with its own owner and review. | Change to `adapters/` or to a connection record goes through the human gate as an access change, never as a steering edit | `overrides-lint` (planned): fails any `steering/overrides/` file that carries `authorized`, a disposition, an adapter, a credential, a secret name, or a scope widening |
| 7 | **A tested kill switch and complete revocation.** Stop execution and remove access across every connection, including active sessions and credentials that sit outside the gateway. | Precondition for any adapter that **writes**: the descriptor names the stop and the revocation path, and the program has exercised both | `kill_switch_tested` date on the connection record; stale past its freshness threshold is a needs-action row |

Where the harness controls the integration, the path is `Authenticated agent → gateway policy check → credential broker → destination system`, with native permissions reinforcing the gateway. Where it does not (an assistant embedded in a vendor's product), the program evaluates the vendor's enforcement, restricts what is reachable, and records the residual as a decision with an owner. Accepting a risk does not technically prevent it.

## `steering/overrides/` — authoritative, and still not authority

`_preamble.md` makes a program's `steering/overrides/<persona>.md` AUTHORITATIVE for that persona. Authoritative over **voice, priorities, emphasis, local vocabulary, the quality bar**. Never over **authority**:

| An override may | An override may not |
| --- | --- |
| Change how a persona speaks, what it leads with, which domains it weights | Set `authorized` or any disposition on any record |
| Add local rules of evidence stricter than the house rules | Loosen the human gate, names-not-values, or no-source-no-fact (the preamble: the safety rule wins and the conflict is surfaced) |
| Name the program's own terms, roles, cadence | Declare, enable or widen an adapter, a connector, a credential, a scope |
| Tell a persona what to refuse | Tell a persona what it is now allowed to write |

Rule 6 applied: an override is an instruction; instructions never grant access. The `overrides-lint` sensor is the mechanism; until it exists, the review at `state-init` reads every override for those tokens by hand.

## Audit is downstream of prevention

Logs and the review record support attribution and detection. They do not substitute for a boundary: recording that an agent deleted a record does not protect the record. The harness orders its controls Identify → Protect → Detect; a program that can answer "who did it" but not "what stopped it" has the second half only.

## The central identity question

> **What trusted system binds the logical identity to authenticated requests and enforced authority?**

For the harness: the agent record (`../inventory/agents.md`) is the logical identity; the adapter runtime's credential is the authenticated request; the adapter descriptor plus the destination's native permissions are the enforced authority. If any of the three is missing, the agent has a name, not an identity.

**The principle to remember:** define the actor, prove who is acting, enforce what it can do — and keep those three independent of anything written in a prompt.

## What this is not

Not a policy on which models or runtimes a program may use — identity survives a model change; a new runtime must be authorized to act for an existing agent, which is an access change. Not a claim that one gateway makes everything safe — it protects only the access that must pass through it; a direct credential or an alternate connector bypasses it, which is why the inventory tracks every path. Not a refusal of autonomy — delegated execution within enforced limits is the goal; undeclared authority is the failure.

## Open items

1. `overrides-lint`: the exact token list and whether it also fails an override that names a system not in inventory. *Lean:* fail on `authorized`, `disposition`, `adapter`, `credential`, `secret`, `scope:`; warn on unknown system slugs.
2. Where the credential broker lives for a local, single-operator program (a password manager with on-demand retrieval is the floor; a proxy that performs the operation is the target). Whether the floor is acceptable for adapters that write. *Lean:* read-only adapters may run on the floor; writing adapters require the broker pattern.
3. Freshness threshold for `kill_switch_tested` (lean: 90 days, or on any change to the connection).
