# airbcdlc-workflows — AI-RBC-DLC

**Meet Satoru, the `/aiciso`.** An AI CISO that runs **AI-RBC-DLC** — the Artificial-Intelligence Risk-Based Control Development Life Cycle. A Claude-only, git-based harness that *builds* a risk-based control program for a company, in that company's own repository, by steering strongly toward one proven way of thinking — without shipping the author's own program.

AI-DLC (`aidlc-workflows`) contains no application; it contains the method that builds applications. This repository contains no security program; it contains the method that builds security programs.

> **Status: M0 (0.1.0-m0) — the engine runs.** Schemas, risk-core steering, the three mandatory personas, the deterministic engine, the `/aiciso` conductor skill, the `breakdown` scope, 11 sensors, and CI are all here and green. The field guide's two worked examples reproduce, and "we'll monitor BYOD" walks to regulatory/legal exposure with the laptop-farm branch named. Start with `docs/plan.md`, then run the quickstart.

## Quickstart

```bash
bun install

# scaffold a program repo and explore the tree
mkdir ../acme && cd ../acme
bun run /path/to/airbcdlc-workflows/core/tools/src/cli.ts init
rbc validate                       # every record schema-checked
rbc tree H1                        # a top-level harm's subtree
rbc trace <tool|control|branch>    # walk any node up to its root harm
rbc sensors                        # the deterministic checks

# the harness's own CI
cd /path/to/airbcdlc-workflows
bun run core/tools/src/cli.ts check   # lint + leak-test + graph + fixtures
bun test                              # sensor mutation canaries
```

**What M0 proves:** `tests/fixtures/example-a` and `example-b` reproduce the field guide's two worked breakdowns; `tests/fixtures/byod-monitor` shows the Intake Reflex turning "we'll monitor BYOD" into four branches — including the remote-operative/laptop-farm branch that crosses to **H2 (regulatory/legal)** — with the monitor placed post-compromise and its blind spots written down. `rbc check` → **CHECK PASSED**.

## Layout

```
docs/                 plan v0.3; addenda (compliance as input; the compliance module)
core/
  steering/           HOW THE AUTHOR THINKS — framework steering, loaded into every stage
    method/           the field guide (source doctrine); vocabulary, breakdown, anti-patterns, refusals
    risk-core/        the tree: top-level harms, intermediate vocabulary, placement, the Intake Reflex, illustration
    inventory/        one file per curated silo (14): why, minimum fields, sources, joins, freshness, attention
    domains/          control doctrine per domain, incl. the harms each prevents and the ask → risk table
    shape/            authoring rules per record type
    program/          Governance → Policy → Control → Operations → Audit; cadence; attention-first; the one metric
    compliance/       compliance as input; ladders; compliance automation as snapshot
    house-rules/      voice · evidence · human gate · "engage, never scold, lead back"
  schemas/            JSON Schema 2020-12 for every record type in a program repo
  stages/             YAML-fronted stage files (7 phases, 31 stages) compiled to a graph
  scopes/             workflow profiles (breakdown · intake · founder · growth · scale · obligation · …)
  agents/             personas (16-section full / compact; preamble; lint)
  sensors/            deterministic checks that fire at gates
  tools/              the engine (Bun/TS): graph · orchestrate · state · audit · validate · sensors · views · sources · trace/tree · publish
compliance/           the compliance module: PROFILE-SCHEMA, profiles/<fw>/, crosswalks, obligations, advisor
adapters/             adapter descriptors (reads and publishes declared separately; CSV/Markdown first-class)
plugins/              overlays (none in core)
tests/                smoke · unit · integration · fixtures · CI validators (leak test, licensed-text guard)
```

## Principles in one breath

Everything lives in git. Compliance is an input, never an origin. Every risk backs out to a small fixed set of top-level harms; decisions carry premises and re-open when premises move. Controls are compiled per program from shape, doctrine, coverage and the company's own inventory — "never assume tools they don't have." Compliance platforms are the bridge to auditors, never the system of record. Nothing agent-authored reaches a record ungated. Citations or nothing.

## Provenance

Patterns borrowed, with thanks, from AWS's [`aidlc-workflows`](https://github.com/awslabs/aidlc-workflows) (MIT-0) and from the author's own [`odeshi`](https://github.com/wiicode/odeshi). Framework texts are the property of their publishers; this repository carries identifiers and the author's doctrine, never licensed text (see `docs/addendum-b-compliance-module.md` §2).

## License

MIT-0. See `LICENSE`.
