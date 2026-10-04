<!-- scope: agents · the persona file format. Authoring rule, not a persona. -->
# Persona format

Two variants per role. The **full profile** (~8–11 KB) is injected into a Moderate/Complex sub-agent; the **compact** (~2 KB) is applied inline at Simple tier.

## Full profile — sixteen sections

```
# <Role Name>

## 1. Role Identity        — "You are a <role> with expertise equivalent to …"; a line pointing to _preamble; Role-Specific Caveats
## 2. Core Expertise       — ~6 bolded bullets
## 3. Key Responsibilities — bullets; one names what you are the authority on
## 4. Decision-Making Authority — "You can propose unilaterally on …" / "Escalate when …" (a persona proposes; it never decides a disposition)
## 5. Collaboration Style  — ### When Leading / ### When Supporting
## 6. Inter-Expert Collaboration — table: Collaborating With | Your Role | Handoff Triggers
## 7. Tier-Specific Behavior — table: Tier | Engagement Depth | Focus
## 8. Quality Standards     — grouped bullets; ends with a single italic **Final probe**
## 9. Communication Patterns
## 10. Red Flags You Watch For — each bullet an action: "Hunt for…", "Verify…", "Trace…", "Challenge…"
## 11. Limitations & Blind Spots — "You cannot observe…"
## 12. Key Questions You Ask
## 13. Common Patterns You Recommend
## 14. When NOT to Engage   — each line routes to the persona who should instead
## 15. Engagement Triggers
## 16. Success Indicators
```

Conventions: every Red Flag is an action the lens takes, not a noun. Every "When NOT to Engage" line names another persona. The Final probe is one italic question. The HANDBACK (from `_preamble`) carries STRONGEST OBJECTION + FALSIFIER.

## Compact profile

```
# <Role> (Compact)
You are a <role> — <one-line identity incl. what you are the authority on>.
## Core Expertise        (6 bullets)
## Decision Authority    (3–4 bullets; propose-not-decide)
## Red Flags             (6–7 bullets, each "<signal> — <what you do about it>")
## Adversarial Behaviors (3 bullets)
## Handback Format       (the HANDBACK block from _preamble)
Full profile: core/agents/<role>.md
```

## The reviewer is special

The adversarial reviewer (`business-owner`) does not validate work — it finds what is weakest. Its output is the **review record** (`core/schemas/review-record.schema.json`): FAILURE MODES TESTED (each with result and evidence), #1 PROBLEM, CONFIDENCE CALIBRATION, VERDICT. A bare "no concerns" is rejected; the reviewer must explain the absence. Reviewer output is forwarded verbatim; analyst output is compressed.
