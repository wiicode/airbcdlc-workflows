---
title: Atlassian Seat and Access Reconciliation
category: access
system: Atlassian Cloud (org admin API, Jira, Confluence, Atlassian Guard)
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [access-reconciliation, monitoring-atlassian, access-identity-lifecycle, foundation-privacy-safety-secrets, foundation-ai-analyst-triage]
---
# Atlassian Seat and Access Reconciliation

## Why this matters

Atlassian is usually the largest paid-seat pool outside the IdP, and the one most likely to hold leavers: Jira and Confluence seats are granted ad hoc, product access is per-product, and the org directory accumulates managed accounts, portal-only customers, and app accounts side by side. The per-seat price makes bleed visible to finance; the fact that a deactivated account stops billing immediately makes reclaim measurable. This file is the Atlassian-specific slice of cross-system reconciliation: what the org API gives you, how to map it to billable seats and to the people system-of-record, and how a deactivation action can be offered safely.

## Data sources & access method

| Endpoint | What it returns | Notes |
|---|---|---|
| `GET https://api.atlassian.com/admin/v1/orgs/{orgId}/users?limit=100` | Every account in the org directory: `account_id`, `email`, `name`, `account_type`, `account_status`, `access_billable`, `last_active`, `product_access[]` | Bearer org API key. Follow `links.next` for pagination. This is the Atlassian Guard directory view. |
| `GET https://api.atlassian.com/users/{accountId}/manage/profile` | Live profile incl. `account.account_status`, `account.email` | Used before any action — never act on the local mirror |
| `GET https://api.atlassian.com/users/{accountId}/manage` | Capability flags, incl. `lifecycle.enablement.allowed` and a reason key | Tells you whether the API may deactivate this account (managed accounts only) |
| `POST https://api.atlassian.com/users/{accountId}/manage/lifecycle/disable` | Deactivates a managed account; body `{message}` | Returns 204. Billing stops. |

Things learned about the API surface:

- The newer `/directory/users` path returned 404 for this org key; the `admin/v1/orgs/{id}/users` path worked. Try the documented paths in order and keep the one that answers.
- Some admin reporting endpoints are gated by license tier (Atlassian Guard Standard vs. Premium). Design the puller to degrade: if an enrichment call is refused, keep the base directory and note the gap in the run.
- The org API **lags the console by hours** after a deactivation. A just-deactivated account can still read `active` and `access_billable: true`.
- Keep the org API key out of logs; it goes only in the `Authorization` header.

## Collection tactics

- One full sweep per sync, paged 100 at a time with a generous page cap; abort the sweep (not the inventory) on a non-2xx so a transient failure never tombstones the directory.
- Normalize at pull time into the shared account row shape (see access-reconciliation):

| Normalized field | From | Rule |
|---|---|---|
| `active` | `account_status` | `active` → 1, anything else (`inactive`, `closed`) → 0 |
| `billable` | `access_billable` | straight boolean |
| `is_guest` | `account_type == "customer"` | portal-only customers are not billable and have no roster record |
| `is_bot` | `account_type == "app"` | app accounts never flag |
| `status` (display) | `account_status` + type | e.g. `active (customer)` so the table explains itself |
| `last_active` | `last_active` | ISO; null if absent |
| `extra.products` | `product_access[].name` | the Jira vs Confluence split lives here |

- Record `admin` as unknown (null) from this endpoint — org-admin role is not on the user object. Derive admin posture from a separate roles pull if your tier allows, or from audit-log actor analysis (see monitoring-atlassian).
- Email is lower-cased; it is the join key to the roster and to the IdP.

## Normalization & joins

- **Billable seat mapping.** A billable seat is `access_billable && account_status == active`. Deactivated accounts may still list product roles; those cost nothing. Do not count `product_access` entries as seats — count the billable flag once per account.
- **Jira vs Confluence.** `product_access[]` names the products (Jira Software, Jira Service Management, Confluence, etc.). Keep the list in `extra` and surface it in the row; for reclaim decisions the operator wants "which product is this seat actually for". A person with Confluence-only access who left is a cheaper reclaim than a Jira Software admin, but both are bleed.
- **Guests / external.** `customer` accounts are service-desk portal users: expected to lack a roster record, not billable, never ORPHAN. Managed accounts on an external domain *are* graded; they will show as ORPHAN unless the roster knows them (contractor record or a Service Account marker).
- **Join to the roster** by email. Join to the IdP by email as well; an active billable Atlassian account with no IdP identity is IDP-BYPASS (SSO/MFA not enforced for that sign-in).
- **Inactive-but-licensed.** Rarely occurs on Atlassian (deactivation clears billing), but `inactive` + `access_billable: true` right after a deactivation is the lag, not a finding. Suppress for 24 h after a logged action.

Pseudo-SQL for the bleed-by-product view the operator asks for first:

```sql
SELECT p.product, COUNT(*) AS paid_seats_at_risk
FROM ar_accounts a
JOIN LATERAL jsonb_array_elements_text(a.extra->'products') AS p(product) ON true
LEFT JOIN ar_accounts r ON r.source = '<system-of-record>' AND lower(r.email) = lower(a.email)
LEFT JOIN ar_accounts j ON j.source = '<idp>' AND lower(j.email) = lower(a.email)
WHERE a.source = 'atlassian' AND a.gone_at IS NULL
  AND a.active = 1 AND a.billable = 1 AND a.is_guest = 0 AND a.is_bot = 0
  AND (r.status IN ('Gone','Suspended','Preserve') OR r.email IS NULL OR j.active = 0)
GROUP BY p.product ORDER BY paid_seats_at_risk DESC;
```

Read the result as "seats whose holder is not entitled", not as "seats to cut today" — the orphan rows still need an owner search first.

## Signals & finding rules

Atlassian-specific readings of the shared rule set:

| Kind | Atlassian trigger | Verb shown to the operator |
|---|---|---|
| ACCESS-VIOLATION | roster Gone/Suspended/Preserve and `account_status == active` | deactivate (Preserve: deactivate; data remains in the site) |
| ORPHAN | `active`, `account_type == atlassian`, no roster record | identify the owner; deactivate if nobody claims it |
| LICENSE-BLEED | `access_billable && active` and the holder is gone / unknown / IdP-suspended | deactivate — billing stops at once |
| IDP-BYPASS | active managed account, no IdP identity, roster Active/Going/unknown | bind through the IdP or deactivate |
| IDLE (info) | billable, active, `last_active` older than the window | ask whether the seat is needed; downgrade to a non-billable role |
| ADMIN (posture) | org admin or site admin and roster not Active | treat as ACCESS-VIOLATION at high regardless of seat |

Rules of thumb that held up:

- Deactivation is the universal reclaim on Atlassian. Revoking product access one by one is slower and leaves the account able to sign in.
- "Last active" is the only usage signal from the org API; treat it as coarse (days, not minutes) and never alone as bleed.
- Dozens of billable seats with no IdP account is a typical first-run picture in a tenant that adopted SSO after Atlassian; expect it and plan an IdP-binding campaign rather than mass deactivation.

## Analyst triage & evidence

- **Action: deactivate** — two-phase.
  1. *Preview*: validate the account id shape, read the live profile (`before` status), short-circuit if already `inactive` (mirror locally, note "already deactivated"), read `lifecycle.enablement`; if `allowed === false` return the reason key (typically "not a managed account") and log a refused attempt.
  2. *Execute*: `POST .../lifecycle/disable` with a message naming the process ("deactivated by the security team via access reconciliation — offboarded in the system-of-record"). On 204: set `after = inactive`, mirror `active = 0` on the local row, log the action row. Note in the result that billing stops and the org API may lag.
- **Why read-only by default.** The control-plane's value is trusted evidence. A write path is justified only when (a) the vendor action is unambiguous and reversible enough, (b) it is tied to a roster state the operator already agreed is terminal, and (c) the preview re-reads live state so a stale mirror cannot trigger it. Atlassian deactivation passes all three; product-role surgery does not, so it stays manual.
- **Two-click confirm** in the row: the first click shows the preview result inline; a second explicit click on the red button executes. Keyboard focus never lands on the danger button by default.
- **Access review record.** When a batch of deactivations is done from the page, export the review (identities, before/after, rejected ones with the vendor's reason such as "conflicting state", gateway errors to retry) as a dated Markdown file. That export is the audit artifact; the `ar_actions` table is its source.
- **Analyst packet facts** the model must be told: deactivation stops billing; product roles may remain listed at no cost; portal-only customers are not billable; the org API lags the console; a deactivated account reappearing as active within hours is lag, not re-enablement.
- Triage vocabulary is the shared one (REVOKE / RECLAIM / RECERTIFY / EXPECTED / LEAD / HYGIENE). On Atlassian, REVOKE and RECLAIM collapse into the same action — say so in the report rather than listing both.

## Pitfalls & lessons learned

- **Conflicting-state rejections.** A small number of deactivations were refused with a "conflicting state" error — the account was mid-change in the console. Retry later; do not mark the finding resolved until the next sync confirms.
- **Gateway 504s** during a batch: treat as "unknown", re-read the profile, then retry. Never log a success you did not observe.
- **The directory includes app accounts** (`account_type == app`) and portal customers; filtering them late inflated the orphan count on the first run.
- **The admin role is not on the user record.** Teams expected an `is_admin` flag; it needs a separate source. Leave the column null rather than defaulting to false.
- **Pagination caps.** A fixed page cap that is too low silently truncates large directories; make it generous and log the page count.
- **Mirror immediately.** Without the local mirror, the page showed the just-deactivated account as still active for hours and operators repeated the action.

## Do not

- Do not treat `product_access` entries as seats; the billable flag is the seat.
- Do not grade `customer` (portal-only) or `app` accounts as orphans or bleed.
- Do not execute a deactivation from the local mirror; preview must read the live profile and the lifecycle capability first.
- Do not revoke product roles piecemeal from the control-plane; deactivate or leave it to the console.
- Do not log the org API key or echo it in error strings.
- Do not mark a finding resolved on the strength of your own action; wait for the next sync to confirm.
- Do not run a mass deactivation on the first run — reconcile roster gaps and IdP bindings first.

## Related steering files

- access-reconciliation — the shared account table, rules, exemptions, and analyst report
- monitoring-atlassian — audit-log based monitoring and admin-actor detection
- access-identity-lifecycle — roster lifecycle states that drive the terminal verdicts
- foundation-privacy-safety-secrets — key handling, scopes, redaction
- foundation-ai-analyst-triage — persona and packet pattern for the report
