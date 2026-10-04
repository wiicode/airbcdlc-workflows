---
title: EDR Coverage — system-of-record devices vs live sensor, policy and MDM state
category: analysis
system: CrowdStrike Falcon + JumpCloud + device/people system-of-record
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, foundation-privacy-safety-secrets, monitoring-crowdstrike, monitoring-jumpcloud, analysis-endpoint-fleet-inventory, access-identity-lifecycle, analysis-sso-adoption-metrics]
---
# EDR Coverage — system-of-record devices vs live sensor, policy and MDM state

## Why this matters
The compliance claim under test is simple to state and hard to prove: **every active
employee, contractor and intern works on a company-issued device that carries a live
EDR sensor with an enabled, applied prevention policy; every external contractor has a
BYOD device record on file.** The EDR console can tell you which hosts have a sensor; it
cannot tell you which *people* are uncovered, because it does not know who owns what.
The device/people system-of-record knows ownership but not live sensor state.

The control-plane joins the two and surfaces the gaps. It does not re-implement the
system-of-record (the device↔owner alignment there is usually good data, just exhausting
to review by hand) and it never writes upstream from the coverage view. The one write-back
exception is the externals/BYOD autolink described below, and it is dry-run first and
audited.

A second lesson shaped the design: the system-of-record's own EDR "firehose" export table
had silently gone stale months earlier (every row archived, last-seen frozen), so every
health marker derived from it was the export being dead, not the fleet. **Use the
system-of-record for the mapping chain only; take state from the live APIs.**

## Data sources & access method
| Source | Role | Method | Notes |
|---|---|---|---|
| System-of-record Devices table | mapping chain | REST, full sweep | fields: purpose (Primary/Secondary/…), inventory state (With Owner / Provisioning / BYOD / Retired …), serial, hostname, EDR device id (`av-guid`), MDM system id, `policy-antimalware`, `policy-dlp`, `policy-mdm`, current owner link |
| System-of-record Employees table (+ vendor table) | population | REST, full sweep | status (Active/Coming/Going/Gone/Suspended), type (Employee/Contractor/Intern/External/Other/Service), device links, username local-part, vendor name |
| System-of-record audit views | "system-of-record says" chips | REST, record ids only, per view | the operator's own saved review views (missing device, primary missing, BYOD, AV issues) — a 422 on one view is recorded and the rest continue |
| EDR hosts API (Falcon) | live sensor state | OAuth client-credentials; `queries/devices` → `entities/devices` in batches of 100 | `last_seen`, `reduced_functionality_mode`, `device_policies` (prevention, sensor_update, data-protection), host groups, tags, serial, hostname, `last_login_user` |
| EDR prevention policies + host groups | policy truth | `policy/combined/prevention`, `devices/combined/host-groups` | a policy *assigned* to a host can itself be disabled — check `enabled` on the policy, not just the assignment |
| MDM / directory systems (JumpCloud) | MDM contact, FDE, bound users | `GET /api/systems` paged, then `/api/v2/systems/{id}/users` | a few in flight, sequential DB writes |
| GRC platform device agent (e.g., Vanta) | externals' real hostnames | REST `monitored-computers` + the vendor's MCP `listComputers` | **REST has no hostname**; only the MCP tool returns `name`; its `id` equals the device UDID — that is the join key |
| SIEM keyword search | weak "seen on our network" sightings for BYOD hostnames | records-mode job per chunk of 25 hostnames | manual button only; hostnames restricted to `[A-Za-z0-9._-]` and regex-escaped |

All reads are read-only. Secrets live in env; nothing from `device_policies` raw is
exported.

## Collection tactics
- **Sequential sync** per source (system-of-record → EDR → MDM → views → GRC agent), each
  writing a sync-run row (`ok | warning | error`, count, summary). A full sync is tens of
  seconds; predictable pool use matters more than speed.
- **Mirror tables with lifecycle** (`first_seen / last_seen / gone_at`) for devices,
  people and hosts. Keep the source `raw` JSON per row; promote only the columns the rules
  read.
- **Sidecar table for host policies**: store `policies_json`, `groups_json`, `tags_json`
  whole, plus derived columns (prevention policy id, applied flag, uninstall protection,
  data-protection applied). A new rule then costs no API call.
- **Observability gate for optional policy keys**: DLP (`data-protection`) only exists in
  `device_policies` on tenants that license it. Record `dlp_observable = key ever seen`;
  if false, skip the DLP rule rather than reporting a tenant-wide gap.
- **Stale-export banner**: if the system-of-record's EDR export table's max `last_seen`
  is older than N days while the live API returns hosts seen today, banner it. Never
  derive state from it.
- **Hostname import for externals is manual** and idempotent by UDID; REST syncs never
  emit the hostname columns, so imported names survive later syncs.

## Normalization & joins
**Host → device matching chain**, run as ordered passes over the whole fleet; a host is
claimed by at most one device:
1. `host.device_id == device.av_guid` (**GUID**)
2. `host.serial == device.serial` case-insensitive, trimmed (**SERIAL**)
3. hostname label == device agent-name label (**HOST**)
4. else **UNMAPPED-HOST**

MDM system → device uses the same chain over `mdm-guid` → serial → hostname.

**Person for a host** = the device's current owner (plus the Employees→Devices inverse
links). An unmapped host gets a **probable owner** from `last_login_user` against
Employees username / email local-parts, then directory usernames — *shown, never
asserted*.

**Population P** = people with status in {Active, Coming, Going}. Staff = Employee /
Contractor / Intern. External = External / External-NoID / Other. Exclude Service
Account / Ignore / Group / Alias rows. **Company device** = purpose Primary or Secondary
AND inventory state in {With Owner, Provisioning, Re-provisioning, Procurement, RFI
Pending}. Retired / Peripheral / Accessory / Storage devices are out of scope.

Externals/BYOD: agent → person by owner email (GRC asset or vendor owner email) against
Employees primary/alternate email, lower-cased. Device ↔ agent link = the Devices link
field ∪ the asset's inverse link. Junk serials (`Default string`, `SYSTEM SERIAL NUMBER`,
`To be filled by O.E.M.`, all zeros) are treated as null; a synthetic `<owner> — windows`
hostname is never used as a hostname.

## Signals & finding rules
Rules are pure, read-time functions over the mirrors (fixture-tested), so they evolve
without a resync. Every finding carries kind, severity, subject (person / device / host),
evidence lines, per-system actions and deep links.

| Kind | Sev | Triage | Rule |
|---|---|---|---|
| NO-COMPANY-DEVICE | high | FIX | staff in P with no company device (and not BYOD-only) |
| BYOD-INSTEAD-OF-WORK | high | FIX | staff in P whose only device records are BYOD |
| EXTERNAL-NO-RECORD | low | RECORD | external in P with zero linked devices |
| NO-SENSOR-ID | high | FIX | company device, owner in P, AV policy = EDR, `av-guid` empty, nothing matched by serial/hostname |
| SENSOR-NOT-FOUND | high | FIX | `av-guid` set, no live host by GUID, nothing by serial/hostname |
| GUID-MISMATCH | low | RECORD | host found by SERIAL/HOST but `av-guid` empty/stale — update the id |
| SENSOR-STALE | med >14d · high >45d · info if Storage/Damaged/Missing | INVESTIGATE / EXPECTED | mapped host `last_seen` older than threshold, owner in P |
| SENSOR-RFM | med | FIX | reduced functionality mode = yes |
| POLICY-DISABLED | high | FIX | prevention policy `enabled = 0`, or `applied = false` on the host |
| POLICY-NONSTANDARD | low | RECERTIFY | enabled prevention policy that is not the platform default |
| UNINSTALL-PROTECTION-OFF | med | FIX | `sensor_update.uninstall_protection` not in {ENABLED, IGNORE} — IGNORE is the Linux sensor (no such setting), treat as N/A |
| HOST-GROUP-FLAG | med | RECERTIFY | host in a "non-compliance" / "monitoring only" host group |
| DLP-POLICY-GAP | med | FIX | device says DLP policy, host has no applied data-protection policy; skipped when `dlp_observable = false` |
| UNMAPPED-HOST | med | RECORD | live host matching no device — unknown hardware carrying our sensor |
| GONE-OWNER-SENSOR-ALIVE | high | INVESTIGATE | host seen ≤14d, owner Gone/Suspended or directory user suspended |
| MDM-WITHOUT-SENSOR | high | FIX | active MDM system (contact ≤30d) on an EDR-policy device with no live host |
| SENSOR-WITHOUT-MDM | low | RECORD | live host on a `policy-mdm = Full Enrollment` device with no MDM system |
| OTHER-AV | info | EXPECTED | alternate AV vendor on record — listed, not scored |
| AV-EXEMPT | info | EXEMPT | AV policy = Exempt — excluded from the coverage denominator |

Host-level rules (RFM, policy, uninstall protection, host group, DLP) run for every live
host; on mapped hosts the finding rides on the device/person, on unmapped hosts it sits
with the host in its own section.

**Coverage %** = staff with status Active, ≥1 company device whose host was seen ≤14d,
prevention applied and enabled, not RFM ÷ (staff Active − AV-exempt).

**"System-of-record says" chips + disagreement filter**: pull the operator's audit views
as record-id memberships and render them as chips per person/device. Set `review = true`
when the app flags NO-COMPANY-DEVICE / BYOD-INSTEAD-OF-WORK / EXTERNAL-NO-RECORD but no
"missing device" view holds the person — or vice versa. The disagreement set *is* the
review queue; agreement needs no human.

**Externals/BYOD states** (first that applies is primary; all are listed):
GONE-AGENT-LIVE → NO-BYOD-RECORD → BYOD-PURPOSE-MISSING → AGENT-UNLINKED →
AGENT-NAME-PLACEHOLDER → AGENT-STALE (>14d) → NO-AGENT. GRC-agent check outcomes
(screenlock / password manager / disk encryption / AV) are reported with a fixed
disposition per integration class, not per-row exemptions.

## Analyst triage & evidence
- **Vocabulary**: FIX / RECORD / RECERTIFY / EXPECTED / EXEMPT / INVESTIGATE — every
  finding must land in one. The analyst persona is "SecOps analyst — endpoint protection
  coverage evidence", terse contract (Headline · Facts · Since last report · Triage · Next
  steps · Gaps).
- **Exemptions table**: subject (person email or device id), kind or all kinds,
  disposition {expected, false-positive, accepted-risk, other-av, not-applicable}, reason
  required, optional expiry. Muted findings render struck through and are counted in
  `summary.muted`; they never disappear.
- **Agent-facing brief export** (md/json): sources, summary, rulebook, every live finding
  with evidence and per-system actions (system-of-record / EDR / MDM links). Feed it to a
  human or an AI operator who does the fixes; the control-plane never fixes upstream.
- **Dataset**: collections people / devices / hosts_unmapped / findings; headline metrics
  covered_pct, no_company_device, sensor_stale_45, policy_disabled, unmapped_hosts,
  gone_owner_alive. Volatile fields (last_seen, days-since) excluded from entity hashes.
- **Device-alignment rules to encode as policy text**: every active staff member has a
  Primary + With Owner device carrying the sensor; externals are "company-approved BYOD"
  and must have a BYOD record; every MDM device carries the sensor; a device still alive
  after its owner left is an incident, not hygiene.

## Pitfalls & lessons learned
- **Autolink is the only write-back, and it is engineered as an exception**: per-row
  dry-run plan (create vs update, target record pick order: linked → Primary → newest),
  conflicts reported never written (different non-placeholder hostname, non-Primary
  purpose set, agent already linked to someone else's device, Gone person), live re-read
  of the target immediately before the write, append-only writes audit log (fields sent,
  before-values, ok/error), "autolink all safe" writes only conflict-free plans one at a
  time and stops on a scope error. A 401/403 must say "token lacks write scope on this
  base" in plain words.
- The GRC platform's public REST API has **no hostname**; only its MCP tool does, and the
  MCP `id` is the UDID. Plan for a manual import step and banner how many are still
  missing.
- Linux sensors report `uninstall_protection = IGNORE` — not a finding.
- Prevention policies can be *assigned* yet *disabled*; hosts on a disabled policy are
  "sensor present, not preventing". Check both `applied` and policy `enabled`.
- Duplicate emails in the people table (alias/group rows) break email-keyed entities —
  fall back to a `rec:<id>` key.
- SSO `auth_context` (managed-device assertion) is a cheaper cross-app device-trust
  signal than a new collector — reuse it before inventing one.
- Metric key names like `password_*` or `token_*` get dropped by a secrets sanitizer; name
  them `pwmgr_fail` etc.

## Do not
- Do not derive sensor state from a system-of-record export table; use the live API.
- Do not assert an owner for an unmapped host from `last_login_user` — show it as probable.
- Do not hide muted/exempt findings; strike through and count them.
- Do not write to the system-of-record from the coverage view; only the audited autolink
  path writes, and only after a dry-run.
- Do not report a DLP gap when the tenant has never exposed the data-protection key.
- Do not treat "no managed-device context" on an SSO login as proof of BYOD.
- Do not export `device_policies` raw, serials of personal devices, or GRC-agent owner
  emails outside the local dataset.

## Related steering files
- foundation-control-plane-architecture — mirrors, lifecycle columns, sequential syncs
- foundation-evidence-datasets-snapshots — entity vs state hashes, volatile fields
- foundation-ai-analyst-triage — persona contract and triage vocabulary
- monitoring-crowdstrike, monitoring-jumpcloud — the collectors this analysis reads
- analysis-endpoint-fleet-inventory — the field / RMM fleet counterpart
- access-identity-lifecycle — Gone/Suspended status feeding GONE-OWNER-SENSOR-ALIVE
- analysis-sso-adoption-metrics — `auth_context` managed-device evidence
