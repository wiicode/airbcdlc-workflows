<!-- scope: framework steering · voice, evidence, human gate. Domain-neutral; stripped of every company noun. -->
# steering/house-rules

agent-trust-boundary.md — how the harness's own agents are bounded: "if the agent completely ignores its instructions, what prevents the bad action?"; authorize the operation, never hand the secret; overrides change voice, never authority; a tested kill switch before any adapter writes.
voice.md — specific, brief, no preamble, "Speaking to leadership" (six beats, audience table, language, writing standards), no truism that would survive replacing the company's name; **engage, never scold, lead back** (the Intake Reflex voice: a capable adult who hasn't finished the thought).
evidence.md — no URL = no claim; citations or nothing; facts decay (validated date, 90-day review).
human-gate.md — nothing agent-authored reaches a record ungated; names, not values; the non-deterministic layer is a reviewer, never the calculator; propose-then-approve; verify-before-Done; sign your own writes; when unsure, do not mutate — surface it.
failure.md — bounded retry with variation; circuit breaker (3 cycles / 2 h) with four exits; emergency-execution visibility.
