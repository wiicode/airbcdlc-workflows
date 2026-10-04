---
title: Evidence Datasets & Snapshots — the Page Dataset Standard
category: foundation
system: cross-cutting
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, analysis-edr-coverage, access-reconciliation]
---
# Evidence Datasets & Snapshots — the Page Dataset Standard

## Why this matters

An oversight page that only renders a table is a dashboard. An oversight page that can **export exactly what it showed, prove it has not been altered, and say what changed since last quarter** is evidence. Auditors ask for the second thing. So does the operator six months later when a finding is disputed.

The page dataset standard makes every oversight page produce the same four affordances — **Export JSON, Snapshot, History, Deltas** — plus an optional analyst report, from one declared shape. A page that adopts the standard gets all of it for the cost of one provider file. A page that does not adopt it cannot be pushed to the GRC platform and should be treated as unfinished.

## The canonical dataset shape

Every page declares a `PageDataset` and implements `collect(scope) → Payload`. Everything downstream — export, snapshot, diff, analyst packet — reads this shape and never the page's own tables.

```ts
type Entity = {
  collection: string;                 // "identity" | "device" | "finding" | "rule" …
  key: string;                        // stable identity: lowercased email, ARN, device id
  label?: string;                     // display only; hashed, never used as identity
  fields: Record<string, string | number | boolean | null | string[]>;  // FLAT, dotted keys
};
type Payload = {
  meta: { dataset; schemaVersion; scope; collectedAt; sources: SourceMeta[]; incomplete?: string[]; sanitizer? };
  metrics: Record<string, number>;    // dotted: "by_kind.ORPHAN", "covered_pct"
  entities: Entity[];
  context?: Record<string, unknown>;  // exported, never diffed or hashed
};
type SourceMeta = { name: string; mode: "live"|"snapshot"|"local"|"import"|"none"; asOf: string|null; ok?: boolean|null };
```

Rules that make this work as evidence:
- **Flat fields, dotted keys.** Nested objects become `src.google.active`. Diffs and sanitizers reason about one level.
- **Stable keys.** The key is what the entity *is*, never what it is called. A renamed person is one entity with a changed label.
- **Declare volatile fields per collection** (timestamps, idle counters, "days since"). They are excluded from hashes and diffs so churn without meaning never shows as change.
- **Declare every collection the provider may emit.** The service rejects an entity in an undeclared collection.
- **Bump `schemaVersion`** whenever a field's meaning or shape changes, or the sanitizer changes.

## Pipeline: collect → redact → sanitize → validate → capture

One service function is the only path from provider to export or store. The dataset's own `redact()` runs first (page-specific scrubbing), then the **central fail-closed sanitizer**, then validation (dataset id matches, schema version matches, collections declared), then capture. If the sanitizer throws, nothing is exported or stored. The sanitizer's report (dropped key paths, redaction counts by type) is written into `meta.sanitizer` and travels with the payload, so the evidence records what was removed from it.

The sanitizer keeps real identities by decision — emails and names are the point of access evidence — and removes anything that can authenticate or that carries unreviewed upstream blobs: keys named `raw`, `extra`, `content`; keys whose segments name a credential (`token`, `secret`, `password`, `api_key`, `private_key`, `session_id`, `webhook_url`); any string value matching a token shape (cloud key ids, JWTs, bearer headers, `user:pass@` URLs, PEM blocks). A key is *kept* when its last segment is metadata (`_count`, `_enabled`, `_policy`, `_expires`, `_remaining`) or its first segment is posture (`mfa_`, `has_`, `is_`) — `password_policy` and `otp_enforced` describe a credential, they do not contain one. Stringified JSON is parsed, sanitized recursively and re-serialized so a blob cannot smuggle a denied key. Stored blobs are **re-sanitized on read**; a sanitizer improvement reaches old evidence, and anything it removes is recorded in `meta.sanitizer.on_read`.

## Two hashes: entity vs state

This is the integrity rule that was learned the hard way. Keep both.

| Hash | Covers | Gates |
|---|---|---|
| **entity hash** (= content hash) | dataset id, schema version, scope, metrics, and `[collection, key, entityHash]` per entity with volatile fields removed and entities sorted by `collection|key`. | Writes to the slowly-changing `entity_versions` table. Equal to the previous capture ⇒ "entities unchanged", zero version rows written, `deduped: true`. |
| **state hash** | entity hash **plus** per-source `{name, mode, ok, asOf}`, the sorted `incomplete` list, and `context`. | Blob reuse. Equal ⇒ reuse the previous blob. Different ⇒ store a new blob even when deduped. |

Why two: a capture whose entities are identical but whose source went `ok → failed` has the same entity hash. With one hash the failed sync would dedup against the healthy one and the failure would be erased from the record. With two, the entity timeline stays clean and the failure is still stored.

Canonicalization before hashing: keys sorted at every depth, strings NFC-normalized, `-0 → 0`, non-finite numbers → null, `undefined` dropped, entities ordered by `collection|key` so producer order never changes a hash. `collectedAt`, source `asOf`, `context`, `meta.sanitizer` and volatile fields are all outside the entity hash.

## Snapshots in a never-truncated history schema

`capture()` does all expensive work (canonicalize, hash, gzip, diff prep) *before* the transaction, then writes in one transaction serialized by an advisory lock so the global hash chain can never fork under concurrent captures.

What is written per snapshot: a **content-addressed gzip blob** (keyed by payload hash, shared when state is unchanged); a **snapshot row** carrying dataset, scope hash, schema version, captured-at, trigger (`export | manual | sync`), label, entity/content/state hashes, counts (`entity_count, added, removed, changed, rehashed`), `prev_snapshot_id` for the same dataset+scope, and a **chain hash** over the previous chain hash plus this row's identifying fields; **snapshot metrics** rows for trends; and **SCD2 entity_versions** rows (`from_snap`, `to_snap`, `hash`, `kind: state|rehash`, body) opened and closed by this capture. The chain hash also covers a digest of the entity-version rows the snapshot opened and closed, so editing history is evident. A `verify` endpoint re-walks the chain and re-hashes every blob.

Consequences the operator must accept: snapshots cannot be deleted without breaking the chain (prune is a policy — keep last N, older than D days — with a mandatory dry run); finished runs and prompt versions are immutable via database triggers; the history schema is excluded from any reset.

Diffs and entity timelines read `entity_versions` intervals only — no blob decompression. Trends read `snapshot_metrics` only.

## Deltas and schema drift

A diff between two snapshots yields metric deltas, per-collection added/removed/changed counts, and per-entity field changes (volatile excluded, label change surfaced as `(label)`). Two rules prevent false change:

1. **Different schema versions ⇒ compare the field intersection only.** An entity whose hash moved because a field was added or dropped, with nothing in the intersection differing, is a **rehash**, not a change. Without this, one new summary field made every resource look CHANGED.
2. **Incomplete collections never close entities.** When a source failed or a pull was partial, the provider lists the affected collections in `meta.incomplete`. Entities absent from those collections are carried forward, never recorded as REMOVED. Partial, errored, and deliberately skipped sources all count as incomplete.

A dataset may supply its own `diffEntity` override returning `[]` for "no meaningful change".

## Analyst evidence reports per page

The analyst step consumes a snapshot, not live data (see `foundation-ai-analyst-triage.md`). Per run the store records: the snapshot id, the base snapshot id (the previous non-test successful run's snapshot for the same dataset+scope), the deterministic diff between them, the prompt version id and prompt hash, the model, the gzip'd packet text (the exact model input, reproducible), the estimated input tokens recorded *before* the call, the report and its hash, and a truncation record (budget, estimate, per-collection coverage, rows dropped). Status is one of `running | ok | truncated | error | refused`. One running run per dataset+scope; a second is refused with 409.

Prompt overrides are versioned in the database (append-only, with change note and row hash chain) with the code default as fallback. A test run against a draft prompt never becomes a base for later runs.

## Pushing evidence to the GRC platform

Every registered dataset is automatically an **evidence source** (`dataset:<id>`) with no platform-specific code: push = capture a snapshot (trigger `export`, labelled for the link) + the stored envelope, byte-identical to what the Export button downloads. Report generators (CSV, Markdown, HTML) register the same way with a one-line `reportSource({ id, scope, label, ext, render })`.

The envelope: `{ schema: "evidence/v1", snapshot: { id, content_hash, entity_hash, state_hash, payload_hash, prev_snapshot_id, captured_at, trigger, label, deduped, chain_hash }, meta, metrics, entities, context }`. A preview (dry run) builds the bytes without capturing and carries `snapshot: null`, so its hash intentionally differs from the pushed file.

Push rules: serialize all pushes in-process (a UI click and a cron curl must not double-push one link); a **freshness gate** skips automatic pushes when any input is incomplete, failed, or older than the cadence window, and records the skip; manual pushes report the verdict but proceed; failures are recorded and never advance `next_due`; every upload is appended to an upload log in the workspace schema. No model is called on any push path — a cached analyst report embedded in an evidence file is read from the database, never regenerated.

## How to add a page to the standard

1. Write one provider file: `id`, `title`, `href`, `schemaVersion`, `collections`, `volatile`, `headline` metric keys, optional `scopeParams`, optional `redact`, optional `diffEntity`, and `collect(scope)`. Read posture, never compute-and-write inside `collect` — a collect that writes corrupts the "export is a pure read" guarantee.
2. Add one line to the dataset registry.
3. Drop the shared `DatasetToolbar dataset="…" scope={…}` into the page header. Export / Snapshot / History / Deltas render.
4. Add an analyst default (persona, output contract, model, max tokens, packet budget) under the dataset id. The toolbar renders the analyst button automatically.
5. The dataset is now pushable to the GRC platform with zero additional code.

## Pitfalls & lessons learned

- A sync that computed posture inside the dataset provider wrote to the database on every export. Providers must read.
- The first deltas flagged hundreds of CHANGED resources after a harmless field addition. Intersection-only comparison across schema versions fixed it.
- A failed sync was once stored as healthy because dedup compared entities only. The state hash fixed it.
- Packet JSON tokenizes at roughly 2 characters per token, not 3.5–4 like prose. Budgets estimated at prose ratios under-counted real input by nearly 2×.
- The export GET has a side effect (it captures). Treat it as a mutation for CSRF purposes: require a same-origin fetch site.
- Exports keep real identities. The operator declined pseudonymization because access evidence without names is not evidence. Document that decision; do not re-litigate it per page.

## Do not

- Do not export or snapshot from a page's own tables. Only the dataset shape.
- Do not include `collectedAt`, `asOf`, `context` or volatile fields in the entity hash.
- Do not close an entity as REMOVED when its collection is incomplete.
- Do not delete snapshots outside the prune policy; the chain will break and `verify` will say so.
- Do not call a model on an evidence push path.
- Do not let a provider write.
- Do not skip the sanitizer "because this page has no secrets". The sanitizer is what proves it.

## Related steering files

- `foundation-control-plane-architecture.md` — the three-schema split this standard lives in.
- `foundation-ai-analyst-triage.md` — how the analyst consumes snapshots and what it is forbidden to do.
- `foundation-privacy-safety-secrets.md` — why identities are kept and secrets are not.
- `analysis-edr-coverage.md`, `access-reconciliation.md` — two pages whose finding kinds and triage vocabularies are good first providers.
