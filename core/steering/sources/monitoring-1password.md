---
title: 1Password — material events and known-device sign-ins
category: monitoring
system: 1Password Business (Events Reporting)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, monitoring-sumologic, monitoring-siem-insights-triage, access-identity-lifecycle, analysis-access-revocations, analysis-endpoint-fleet-inventory, monitoring-screenconnect-rmm, foundation-privacy-safety-secrets]
---
# 1Password — material events and known-device sign-ins

## Why this matters
The password manager is where every other credential lives. Its audit stream is noisy
(every unlock, every session delegation) and low in security content most of the time —
until a departing employee shares a vault, secure-copies items, or a brute-force run hits
an account. The control-plane splits the stream into **two presets with opposite
purposes**:

1. **Material events** — the small set that matters: failed sign-ins, item patch/share/
   secure-copy, secret-key changes. Successful sign-ins and session noise are excluded so
   the stream stays small enough to read daily.
2. **Successful sign-ins** — kept separately, not for security content but as a
   **known-devices source**: the client app, platform/hostname, OS and IP/country of every
   device a person uses the vault from. During offboarding this is one of the few sources
   that names a desktop hostname.

## Data sources & access method
| Source | Path | Notes |
|---|---|---|
| Events Reporting API → SIEM | 1Password's Events API (sign-in attempts, item usage, audit events) ingested by the SIEM's cloud-to-cloud collector | Audit events may land in a **security-records index** (CSE-normalized) rather than the default search index |
| Audit index | the SIEM's security-record index, filtered to the dedicated 1Password collector | Short retention (about a week) on that index — pull daily |
| Sign-in events | the 1Password source category in the default index | Standard retention; raw JSON with dotted keys |

Field shapes (observed):
- Audit (security index): `type`, `category`, `action`, `object_type`, normalized
  `user_email` / `targetuser_email`, `application`, `srcdevice_ip`, device event id
  `audit` vs `usage`.
- Sign-ins (default index): `target_user.email`, `type` (`credentials_ok`),
  `client.app_name`, `client.platform_name`, `client.os_name`, `client.os_version`,
  `client.ip_address`, `location.country`.

Use a **dedicated collector** for 1Password so the security-record index can be scoped to
it; a shared collector makes the index filter fragile.

## Collection tactics
**Material preset**
- Query the security-record index scoped to the collector.
- Keep `(deviceEventId = audit AND category != success) OR (deviceEventId = usage AND action != dlgsess)`
  — i.e. failed audit outcomes plus item usage other than session delegation.
- Actor = normalized `user_email`, falling back to `targetuser_email`. The raw JSON uses
  **literal dotted keys** (`target_user.email`) that JSON-path extraction cannot read; the
  CSE-normalized columns are the reliable source.
- `action = type ?? action`, `target = object_type ?? application`,
  `detail = application + source IP`.
- Expected volume: a handful per day. Verified once: material events were roughly one
  eighth of raw events over a week.

**Sign-ins preset**
- Query the default index on the 1Password category with `credentials_ok`.
- Actor = `target_user.email`. Action is a constant `signin_ok`.
- `target = app · platform · os osv`; `detail = ip=<ip> <country>`.
- Browser extensions report the extension as platform ("Chrome extension"); **desktop apps
  report the hostname as `platform_name`** — that is the known-device value.
- The preset is scopable: the offboarding backfill appends
  `| where toLowerCase(<actor field>) in ("a", "b", …)` for a cohort, so keep the actor
  map a single field.

Both presets run in the normal refresh (24h window) and in cohort backfills.

## Normalization & joins
| Field | Material | Sign-ins |
|---|---|---|
| `source` | `sumologic:1password` | `sumologic:1password` |
| `actor` | user email | target user email |
| `action` | vendor type/action (`share`, `reveal`, `secure-copy`, `patch`, failed sign-in type) | `signin_ok` |
| `target` | object type / application | client string |
| `detail` | application + IP | ip + country |

Sign-in client parsing: `"1Password for Mac · <HOSTNAME> · macOS 15.x"` → app, platform
(hostname when it is a hostname, not a browser/extension/mobile label), OS, version.
A platform is a hostname when it is not a known browser/extension/mobile label.

Known-device join (offboarding): desktop-app hostnames match on **equality** against every
directory-bound system and EDR host — never a platform guess. Extensions and mobile
clients match on platform + major OS version like other UA sources, or are flagged as
mobile (unmanaged by policy).

Actor → person via email through the roster ladder; 1Password emails are usually the
corporate primary and resolve cleanly.

## Signals & finding rules
| Signal | Rule | Weight |
|---|---|---|
| Failed sign-in | audit event, category not success | low each; ≥N per actor per hour → INVESTIGATE |
| Item share | `share` usage | high in offboarding scope; medium otherwise |
| Secure copy / reveal | `secure-copy`, `reveal` | high in offboarding (reveal counts are the exfil tell) |
| Item patch burst | many `patch` by one actor | medium |
| Secret key change / account recovery | audit type in the key/recovery family | high |
| Sign-in from unknown hostname | desktop sign-in whose hostname matches no managed device | medium (`unmatched`) |
| Sign-in from new country | first-seen country for an actor | medium |
| Sign-in by Gone/Suspended user | actor roster status not Active | high — access revocation gap |

Offboarding facts per person: `events`, `shares`, `reveals`, `signins`,
`signin_clients[]` (app · os (n×)). Sign-ins feed the devices signal; they are not
1Password "material" items.

## Analyst triage & evidence
- Material view: a short daily list; anything in it is read.
- Devices view (offboarding): observed clients across Slack, directory insights, SSO,
  RMM logins and 1Password sign-ins, each labelled matched / unmatched / mobile, with the
  1Password desktop hostname shown when present.
- Triage vocabulary: INVESTIGATE (reveal/share burst pre-departure, unknown hostname,
  Gone user signing in) · EXPECTED (admin sharing to a team vault with a ticket) ·
  HYGIENE (failed sign-in clusters from a known user's own device) · REVOKE (active
  session for a suspended person).
- Evidence: counts per signal per person for the departure window; the client list for
  the devices finding. Never export item names or vault names; export object type and
  counts.

## Pitfalls & lessons learned
- The audit events do not appear in the default index; a team spent time concluding
  "1Password sends nothing" before finding the security-record index.
- Dotted literal keys defeat JSON-path extraction; use the normalized columns.
- Short retention on the security index means a missed daily run loses data; monitor
  collector freshness (monitoring-siem-insights-triage).
- Including successful sign-ins in the material preset drowned it; the split is what made
  it readable.
- `platform_name` semantics differ by client type; test on real rows before trusting the
  hostname join.
- Coverage of the known-devices signal from this source is small (only desktop-app users
  with sign-in events in the window) but high-precision; keep it.

## Do not
- Do not merge sign-ins into the material stream.
- Do not filter the material preset on a non-blank actor; failed sign-ins may carry only
  the target user.
- Do not export item titles, vault names, or IPs in shared evidence.
- Do not platform-guess a hostname match; hostnames match on equality only.
- Do not treat a reveal as proof of exfiltration; it is a weighted signal in a scored
  packet a human reads.

## Related steering files
foundation-control-plane-architecture · monitoring-sumologic ·
monitoring-siem-insights-triage · access-identity-lifecycle · analysis-access-revocations ·
analysis-endpoint-fleet-inventory · monitoring-screenconnect-rmm ·
foundation-privacy-safety-secrets
