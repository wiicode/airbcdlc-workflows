# Changelog

## Unreleased
- `core/steering/house-rules/agent-trust-boundary.md` — how the harness's own agents are bounded: the deciding question, authorize-the-operation-never-hand-the-secret, overrides change voice never authority (`overrides-lint` planned), exploration as candidate evidence, tested kill switch before any writing adapter.
- `core/steering/inventory/agents.md` — the agents silo: `agent` and `agent-connection` records, the three identity layers, effective-access reconciliation, attention rows; schemas deferred to M1.
- `core/steering/domains/ai-agents.md` — the first domain file: harms edge, ask → risk table, the ten questions, six coverage expectations, the autonomy ladder with gates.
- `core/steering/program/ai-first-operating-model.md` — the thesis in four forms, crawl/walk/run mapped onto the harness, policy vs operating layer, intake in days, reachability, before/after, measures as candidate views, architecture/operations split.
- `core/steering/house-rules/voice.md` — new "Speaking to leadership" section (six beats, audience table, language, writing standards); READMEs for program, domains, inventory and house-rules list the new files.

## 0.0.1 — 2026-10-02
- Pre-M0 skeleton: layout, plan v0.3, addenda A/B, PCI posture ladder, compliance-automation steering, People inventory steering, framework profile schema, the field guide as method source. No engine yet.

## 0.1.0-m0 — 2026-10-03
Identity: **Satoru**, the **/aiciso**, running **AI-RBC-DLC**.

- **Engine** (TypeScript on Bun, `core/tools/`): `rbc init · validate · trace · tree · sensors · lint · leak-test · graph compile --check · check`. ~16 KB, two deps (ajv, yaml).
- **Schemas** (`core/schemas/`, JSON Schema 2020-12): harm, tolerance, risk-parent, risk-branch (with cross-harm roll-up), decision (premises + ADR fields + dissent), obligation, control library/implementation, finding, scenario, monitoring-proposal, review-record, crosswalk-row, sources, inventory (system/person/device/vendor/access).
- **Risk-core steering** (`core/steering/risk-core/`): harms (roots), intermediate vocabulary, placement rules (the six), the Intake Reflex, illustration, premises, roll-up.
- **House rules** (`core/steering/house-rules/voice.md`): engage-never-scold-lead-back; evidence; the human gate; the calculator rule.
- **Personas** (`core/agents/`): _preamble, FORMAT, risk-assessor, business-owner (adversarial reviewer), accountable-seat — full + compact, with STRONGEST OBJECTION/FALSIFIER handbacks.
- **Conductor skill**: `/aiciso` (`.claude/skills/aiciso/SKILL.md`) — Satoru.
- **Stages & scope**: 5-stage graph (state-init → intent-capture → risk-appetite → breakdown → decide); the `breakdown` scope end to end.
- **Sensors** (11): harm-sentence, single-response, control-link, owner-outside-security, tolerance-referenced, decision-complete, monitor-complete, finding-not-risk, orphan-node, premise-moved, residual-from-control-health.
- **CI**: leak-test (+ licensed-text physical-path guard), lint, graph check, fixture validation + expectation checks; `bun test` mutation canaries.
- **Reserved steering**: external attack-surface discovery (defensive EASM feeding inventory reconciliation; `shadow-asset` sensor planned).
- **Fixtures**: field guide §6.2 (remote-support) and §6.3 (developer-token) reproduce; "we'll monitor BYOD" walks to H2 with the laptop-farm branch named and the monitor placed with its blind spots. `rbc check` PASSED.
