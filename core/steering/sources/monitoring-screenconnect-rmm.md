---
title: ScreenConnect RMM — console security events and client coverage
category: monitoring
system: ConnectWise ScreenConnect (RMM / remote support)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, monitoring-sumologic, analysis-endpoint-fleet-inventory, analysis-edr-coverage, access-identity-lifecycle, analysis-actor-automation-fingerprints, monitoring-1password]
---
# ScreenConnect RMM — console security events and client coverage

## Why this matters
An RMM console is a crown-jewel admin plane. One login grants interactive access to every
enrolled endpoint — in a retail or hospitality estate that means thousands of payment
terminals in other people's stores. Attackers know this: RMM consoles are a preferred
initial-access and lateral-movement tool, and RMM client vulnerabilities are exploited
within days of disclosure. Two oversight questions therefore sit together:

1. **Who is logging into the console, from where, with what client** — and does the
   client match a device we manage?
2. **Which endpoints are running a vulnerable RMM client**, measured per node, not
   "the server was upgraded".

The control-plane answers both: console security events via the SIEM, client-version
coverage via the fleet-management API (analysis-endpoint-fleet-inventory holds the
inventory mechanics; this file holds the security rules).

## Data sources & access method
| Source | Method | Fields |
|---|---|---|
| Console security event log | ScreenConnect security audit forwarded to the SIEM (syslog/HTTP source) | `UserName`, `EventType`, `OperationResult`, `NetworkAddress`, `UserAgent`, time |
| Installed-software inventory | Fleet-management (RMM/automation platform) REST API, bulk software query filtered on the client name | `Name` (carries the instance id), `Version`, `ComputerId`, `DateInstalled`, `DateLastInventoried` |
| Device heartbeat | Same platform's device list | last contact, agent version (often already present in the raw device record) |
| Managed-device baseline | Directory-bound systems + EDR hosts | For "is this client a known device" |

Console event types of interest: `LoginAttempt`, `ChangePasswordAttempt`, session and
permission events as your version emits them. `OperationResult` is the success/failure
field; `UserAgent` is the client string (browser, desktop host client, Electron).

## Collection tactics
- SIEM preset: extract the five fields with `nodrop`, map `actor = UserName`,
  `action = EventType`, `target = OperationResult`, `detail = UserAgent`. Keep
  `NetworkAddress` in the raw copy. Volume is low; no rollup.
- Actor is a **bare username**, not an email. Resolve via local-part against the roster
  ladder; store a manual attribution when a technician's console name differs.
- Client-version pull: one bulk software query over the whole fleet (seconds, even for
  tens of thousands of devices). It is a **full replace**, so re-running it never yields
  newer data; freshness is bounded by each agent's own inventory cycle, not your pull.
- Agent version of the fleet-management agent is usually already in the stored device
  list raw record; promote the column instead of making another call.
- Version floors live in a small config file; editing it re-verdicts the fleet with no
  API call.

## Normalization & joins
Console events normalize to the standard row; `source = sumologic:screenconnect`.

Client parsing from the software row name `ScreenConnect Client (<instance-id>)`:
- `instance_id` — the **server instance** the client belongs to. Pin your own instance id
  in config (`expected_instance_id`); every other id is a third-party RMM instance on a
  device you own or host.
- A name with **no parsable instance id** is not third-party; it is usually the host /
  server application and must be captured separately (`sc_host_version`), excluded from
  the client floor (client-side CVEs do not apply) but surfaced as its own finding.
- Per device, keep **every** client row as `instance → version` with OURS / THIRD-PARTY
  and a per-line verdict. One column per device cannot show a patched own client next to
  an unpatched foreign one.

Device identity joins: software row `ComputerId` → device record → customer/site →
system-of-record device (for ownership and hardening status).

Login UA → known device: parse the console `UserAgent` into platform + OS version; match
against directory-bound systems and EDR hosts on platform + major version (platform only
when the UA version is frozen). Mobile UAs are unmanaged by policy; flag separately.

## Signals & finding rules
**Console plane**

| Signal | Rule | Weight |
|---|---|---|
| Failed login | `LoginAttempt` with non-success result | low each; cluster per user/IP → INVESTIGATE |
| Login from unmatched client | success with a UA that matches no known managed device | high (`rmm-unmatched`) |
| Login from mobile | success with a mobile UA | medium — policy says unmanaged |
| Password change | `ChangePasswordAttempt` | medium; correlate with offboarding window |
| Off-roster login | actor resolves to Gone/Suspended or nobody | high |
| New network address | first-seen `NetworkAddress` for a user in 30d | medium |

**Client coverage plane**

| Verdict | Rule |
|---|---|
| `ok` | version ≥ floor |
| `vulnerable` | version < floor **and** `DateLastInventoried` ≥ `evidence_not_before` (the patch-availability date) |
| `stale` / Unverified | version < floor but the software row was inventoried before the patch existed — proves nothing about current state |
| `foreign_only` | own client patched; only a third party's client is behind — escalate to that operator, not your remediation queue |
| `owned_vulnerable` | own client below floor — your remediation queue |
| `host_app_present` | server/host application on an endpoint — separate finding |

The **evidence gate** (`stale` vs `vulnerable`) is the load-bearing idea. Without it the
fleet read as thousands vulnerable; with it, a few hundred confirmed vs thousands merely
unverified — a different remediation conversation entirely.

Third-party instance triage discriminator: **patch response, not install count**. An
operator who pushed the fixed version fleet-wide on disclosure day is managed, not rogue;
a burst install with zero patched is the profile to worry about. An instance spanning
multiple customers' sites is a segmentation concern on its own.

## Analyst triage & evidence
- Console view: logins by user with roster status, client label, matched/unmatched,
  network address; failures and password changes listed.
- Coverage view: scorecard tiles for own-client coverage and, as **their own tiles and
  filters**, third-party clients (they are compromisable terminals; outreach happens).
  Row filters apply server-side across the whole scope — client-side filtering made a
  tile read one number while the table showed another.
- Always show the version-read timestamp (`sc_inventoried_at`) next to a verdict before
  treating a customer's "we updated" as a dispute; both can be true.
- Triage vocabulary: PATCH (owned_vulnerable) · ESCALATE-OPERATOR (foreign_only) ·
  VERIFY (stale) · INVESTIGATE (unmatched/off-roster login, cross-customer instance) ·
  EXPECTED (known technician client).
- Evidence export: coverage counts per verdict, per instance class; the login list with
  verdicts. No instance ids, customer names, or hostnames in distributed exports.

## Pitfalls & lessons learned
- A client-side CVE means remediation is per-node coverage; "the server was upgraded"
  answers nothing. Server version can be **inferred** from the client ceiling (clients only
  update to match their server) — useful when nobody will confirm it.
- Software-inventory timestamps are often years old; without the evidence gate the fleet
  number is fiction.
- Forcing a fresh inventory is a per-device agent command; the daily cycle usually
  resolves it. Mid-day blind spots of several hours are normal.
- A second RMM instance on your endpoints is common in franchise estates (an operator's
  own tool). Treat it as a known population with its own patch status, not as malware.
- Reachability buckets are only as fresh as the last device sync; warn when the newest
  heartbeat is more than a couple of days old.
- Build output directories: a verification build that overwrites the running dev server's
  output kills every route — use a separate build dir.

## Do not
- Do not count the host/server application against the client floor.
- Do not conflate `stale` with `vulnerable`, or `foreign_only` with `owned_vulnerable`.
- Do not filter coverage rows client-side.
- Do not treat a third-party instance as hostile on install count alone.
- Do not export instance ids, customer names, or `NetworkAddress` values in shared evidence.

## Related steering files
foundation-control-plane-architecture · monitoring-sumologic ·
analysis-endpoint-fleet-inventory · analysis-edr-coverage · access-identity-lifecycle ·
analysis-actor-automation-fingerprints · monitoring-1password
