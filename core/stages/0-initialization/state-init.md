---
id: state-init
phase: 0-initialization
requires: []
mode: inline
---

<!-- scope: stage · initialize program state and the intent record. -->
# Stage: state-init

Establish the program's state file and the per-intent working directory. Detect brownfield (existing records) vs greenfield (`rbc init` output). No records are authored here.

## Steps
1. Confirm the repo is an rbc program (`rbc.config.yaml` present) or run `rbc init`.
2. Open a `rbc/intents/<YYMMDD>-<label>/` working dir for this piece of work.
3. Record the harness version and framework profile in scope.

## Sensors
`orphan-node` (baseline sweep).
