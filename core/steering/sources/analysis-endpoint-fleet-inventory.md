---
title: Endpoint Fleet Inventory — RMM, MDM and Linux fleet sources, derived tables, patch and end-of-support verdicts
category: analysis
system: ConnectWise Automate/ScreenConnect + Esper MDM + Ubuntu Landscape + AWS SSM
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-privacy-safety-secrets, monitoring-screenconnect-rmm, analysis-edr-coverage, analysis-shift-left-adoption, access-identity-lifecycle]
---
# Endpoint Fleet Inventory — RMM, MDM and Linux fleet sources, derived tables, patch and end-of-support verdicts

## Why this matters
A company that ships managed devices (point-of-sale, kiosks, signage, embedded Android,
edge appliances) into many customer sites owns a fleet it does not physically control.
Three managers see it from three angles: the Windows RMM (agent heartbeat, software
inventory, remote access), the Android MDM (devices, groups, users), and the Linux fleet
manager plus the cloud systems manager for the appliance class. None answers the
security questions: *which nodes carry a remote-access client below the patched floor,
which operating systems are past vendor support, which customer's estate is the exposure,
and is the company laptop actually where an employee works?*

The control-plane keeps a local copy of each manager's inventory as **firehose tables**,
derives everything it can locally, and re-verdicts the fleet from stored raw whenever a
floor or rule changes — without touching the vendor API. When a critical RMM client CVE
dropped, the question "is every client patched?" became a per-node coverage queue the
team could drain in hours, because the inventory already existed.

## Data sources & access method
| Source | Pull | Auth & pacing | Yields |
|---|---|---|---|
| RMM list API (ConnectWise Automate style) | `/Clients` (flattened per location), `/Computers`, `/Users` | token exchange → Bearer + client-id header; MFA/TOTP may be required for the token — collect it transiently, never persist | computer name, client/location, OS, last contact, AV definition date, Windows Update date, **remote-agent version (free in the list payload)** |
| RMM bulk software inventory | `GET …/Computers/Software?condition=Name like '%<client>%'&pagesize=-1` | one call, whole fleet, seconds | per-row `Name`, `Version`, `ComputerId`, `DateInstalled`, `DateLastInventoried` |
| RMM per-device hardware sub-resources | `/Processors`, `/OperatingSystem`, `/bios` per device; drives/memory/chassis have **bulk** list endpoints | checkpointed cursor in connector state, soft time budget per run, ~100 ms between devices | CPU model/cores/speed, RAM, disk free, OS build |
| MDM (Esper style) | device groups, devices, users per account | Bearer per account; `{count,next,results}` pagination, ~300 ms between pages | device, group (= customer), platform, user roles |
| Linux fleet manager (Landscape style) | GetComputers, GetActivities, GetEventLog, GetPendingComputers, GetAdministrators | HMAC-signed query API; key/secret from env, never logged | check-in freshness, reboot flag, pending enrollments, who can drive the fleet |
| Cloud systems manager (SSM Fleet Manager) | `DescribeInstanceProperties` sweep + bulk tag/ECS cluster enrichment | SSO profile; Resource Groups Tagging `GetResources` ~100 nodes/call | node id, platform version, cluster name |
| Compliance webhook | `POST /compliance-report` from an on-device check relay | shared-secret header; 401 on mismatch, **503 when the secret is unset** | appended per-node check results (reporting / Pro / fleet-agent / patching / firewall / livepatch / EDR / container health) |

**Preflight before any sync**: one read-only endpoint reports whether each AWS session is
alive (`sts:GetCallerIdentity` per profile, with the login command to fix it), whether an
RMM bearer token is cached (else prompt for TOTP), whether MDM and system-of-record keys
are configured, and when the last compliance report arrived. The sync bar refuses to
start a step whose preflight is red.

## Collection tactics
- **Prefer the undocumented whole-set page size** when it works (`pagesize=-1`), with a
  fallback loop of large pages. Never port a per-id brute force from a legacy Lambda.
- **Bulk + server-side condition first; per-device only as a resumable fallback.** An
  unfiltered bulk software pull (tens of thousands of devices × ~100 packages) is never attempted.
- **Discover the endpoint shape once** (probe a handful of GETs against one device) and
  cache the working path and condition grammar in connector state; RMM v1 resources differ
  between instances.
- **Resync-avoidance doctrine**: store every matched sub-resource as **full raw JSON**;
  compute every derived column locally from the blob (`deriveInventory`, `deriveSoftware`).
  A new question (e.g., "which instance id is this client bound to?") is answered offline.
- **Checkpoint + soft deadline**: process devices in ascending id order, write the last
  completed id to connector state, stop ~1 minute before the route timeout, resume on the
  next call. Reserve most of the budget for per-device work so bulk pulls cannot starve it.
- **Lifecycle via one snapshot helper** (`applyAssetSnapshot`): insert new, update
  changed, refresh `last_seen`, clear `gone_at` on reappearance, and stamp `gone_at`
  **only when a full sweep completed without error**. Manual columns (ticket URLs, notes,
  manual compliance) are never written by syncs; a non-null customer attribution survives.
- **Publishing back to a shared mirror** (if people still work in a spreadsheet-style
  tool): diff-based push — list mapped fields for every record, PATCH only rows with a real
  change and only changed fields, create missing rows, never send formulas/links, never
  clear a cell with an empty local value, never push gone rows.
- Users-only "people" refreshes are separate fast steps so the full computer sweep is not
  the price of a roster update.

## Normalization & joins
- **Computer-name parsing at ingest**: encode the naming convention once
  (`c<company><store><other>`, `<PREFIX>-<store>-<label>`, `<nnn>-appliance`,
  cloud-generated names → empty) and store company / store / other-data columns.
- **Customer attribution**: a curated customers table + search patterns (case-insensitive
  substring on the computer name; longest pattern wins on overlap) → `customer_id`. One
  pattern belongs to one customer. The MDM's device group *is* the customer.
- **People hub**: distinct lower-cased email across RMM and MDM user tables → one identity
  row; no-email accounts stand alone keyed `cw:<id>` / `mdm:<id>`. KPIs: locked, never
  logged in, superusers, cross-system vs single-system.
- **Status** = heartbeat online; **compliance score** = passed checks ÷ total; **kernel
  floor** compared as a (major, minor) tuple — a float compare silently passes 5.4 against
  a 5.10 floor. Formulas live in code, not stored where derivable.
- **Version comparison**: dotted-numeric segments, compared over only as many segments as
  the floor declares (a 3-segment floor is satisfied by a 4-segment build). No numeric
  content → `null`, never a silent pass.
- **Remote-access client display name** `Client (<instanceid>)` carries both the version
  and *which server it answers to*. Parse the instance id; pin the expected instance in
  config or infer the fleet's modal id.

## Signals & finding rules
| Signal | Rule | Verdict / bucket |
|---|---|---|
| RMM client below floor | installed < `min_version` AND reading date ≥ `evidence_not_before` | **Vulnerable** (real remediation queue) |
| RMM client below floor, old reading | installed < floor AND `DateLastInventoried` < patch-availability date | **Unverified** — the snapshot proves nothing about current state |
| RMM client at/above floor | installed ≥ floor | Patched |
| No client row after inventory ran | inventoried, no matching software | No client |
| No inventory yet / unparseable | — | Unknown |
| Third-party client on our hardware | instance id ≠ expected, verdict computed on *its* lowest version | **Foreign** — own scorecard tiles and filters; escalate to the operator, cannot be patched by us |
| Remote-access **host/server** app on a terminal | name is the server app, not a client | own finding (unmanaged remote-access server on payment hardware); never scored against the client floor |
| Remote agent below floor | list-API agent version < `automate.min_version` (observed modal build, raised when the vendor ships) | agent-outdated |
| OS end of support | `eosFor(os, version)` from a hand-maintained table of vendor standard-support end dates (cloud vendor's own date wins when present) | past-EOS / within-90d |
| Stale device | heartbeat / AV definitions / Windows Update older than 3/14/30/90 days **or missing** | hotspot buckets over the whole table |
| Hardware minimums | CPU arch/cores/speed, RAM, OS build, free disk vs config-driven min/recommended tiers | Yes / At minimum / No / Unknown per device; ready % per customer |
| Appliance compliance | 8 boolean checks from the latest report per node | fully / partially / non-compliant; per cluster, per customer, per ISO week |

**Two load-bearing splits** for the RMM-client CVE: *evidence gate* (Vulnerable vs
Unverified) and *instance ownership* (ours vs foreign). Without the first, the fleet reads
several times more vulnerable than it is; without the second, a queue you can drain is
conflated with one you can only escalate. Keep two filters: `owned_vulnerable` and
`foreign_only`, applied **server-side across the whole scope** so tiles and table agree.

**Third-party instance triage discriminator = patch response, not install count.** An
operator who pushed the patched build fleet-wide on disclosure day is managed, not rogue; a
burst install with 0% patched is the profile to worry about. An instance that spans
multiple customers' sites is a segmentation question.

**Company-device usage** (for identities/offboarding, not the store fleet): hour buckets
over 7/14/30 local days from directory OS logins, managed SSO assertions, desktop password
manager sign-ins and chat/remote-access client fingerprints → day class (sustained / touch
/ other-only / mobile-only / unconfirmed) → deterministic verdict (PRIMARY / TOKEN USE /
MIXED / NOT PRIMARY / NO COMPANY DEVICE / INSUFFICIENT DATA) with confidence from evidence
density and source agreement, contradictions subtracting. Measures device *presence*, not
work output; render the privacy statement on every result.

## Analyst triage & evidence
- **Per-device "client stack" column**: list *every* remote-access client as `instance →
  version` with OURS / 3RD PARTY and ✓ / ? / ⚠ per line. One version per device cannot show
  a patched own client beside an unpatched foreign one.
- **Config-driven floors** (`agent-versions.json`, `requirements.json`): editing the JSON
  re-verdicts the whole fleet on the next read, no code change, no vendor call. Carry the
  advisory id, CVSS, URL and summary in the same file so reports cite them.
- **Reports**: per-customer stats + a slide-deck style PDF/HTML from the same aggregation
  function (one source of truth), with the dominant failing build named in words, RAM
  buckets, top CPU models, disk headroom. Hardening dashboard per customer from the
  appliance table. Spreadsheet export limited to what leaves the building (name, email,
  company devices, verdict, one headline sentence — never hours, IPs, serials, heatmaps).
- **Version-read column** (`sc_inventoried_at`) beside every verdict; a dispute ("we
  updated") is checked there first.
- **Freshness ceiling is the agent, not the pull**: the bulk software pull is a full
  replace in seconds, so re-running never yields newer data; the RMM updates a device's
  software rows only when that agent runs its own inventory scan (often nightly, with
  mid-day blind spots). To force a reading: the RMM's "resend software data" command per
  device — only agents seen recently will answer.

## Pitfalls & lessons learned
- A client display name with **no parsable instance id must not count as third-party** —
  treat it as ours rather than invent a finding from missing information.
- Reachability/heartbeat buckets are only as fresh as the last *device* sync; warn when the
  newest heartbeat is more than two days old.
- The RMM token may require MFA; keep the passcode single-use in UI state and clear it
  after every attempt. A failed cloud call or a freshly minted token changes preflight —
  re-run it after each sync.
- A per-project list failure swallowed as `[]` can silently tombstone a whole segment;
  disable the gone-sweep for any table whose fetch partially failed.
- Build with a separate output directory for verification builds; a plain build over a
  running dev server kills every route.
- The appliance patch counts come only from the on-device report, not the systems
  manager — do not expect them from the sweep.
- A kernel version formula using float compare will mis-grade 5.4 vs 5.10.

## Do not
- Do not run an unfiltered bulk software pull across a large fleet.
- Do not conflate Unverified with Vulnerable, or foreign clients with ours.
- Do not score the remote-access *server* app against the client floor.
- Do not persist RMM MFA codes, Landscape secrets, or bearer tokens in logs or tables.
- Do not stamp `gone_at` from a sweep that had any fetch error.
- Do not name customers in distributed reports; group by customer id and let the viewer
  resolve names locally.
- Do not infer intent, performance or attendance from device-usage data.

## Related steering files
- foundation-control-plane-architecture — firehose tables, lifecycle, sync registry
- foundation-evidence-datasets-snapshots — exports and snapshots of fleet verdicts
- foundation-privacy-safety-secrets — what leaves the app in spreadsheets
- monitoring-screenconnect-rmm — session/login events from the same RMM
- analysis-edr-coverage — the corporate-laptop counterpart (sensor coverage)
- analysis-shift-left-adoption — OS end-of-support table is shared with cloud coverage
- access-identity-lifecycle — offboarding consumers of the device-usage verdict
