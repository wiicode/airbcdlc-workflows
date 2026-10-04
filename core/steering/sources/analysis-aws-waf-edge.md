---
title: AWS Edge Posture — ALB Listener Rules and WAF Web ACLs
category: analysis
system: AWS Application Load Balancer, AWS WAFv2, AWS Config, AWS CloudTrail
maturity: field-tested
audience: control-plane builders, security engineers, AI agents
related: [foundation-control-plane-architecture, foundation-evidence-datasets-snapshots, foundation-ai-analyst-triage, monitoring-aws-cloudtrail, analysis-aws-iam-admins, analysis-pentest-cadence]
---
# AWS Edge Posture — ALB Listener Rules and WAF Web ACLs

## Why this matters
The front door of a SaaS estate is a stack of ordered rules: ALB listener rules decide where a request goes, WAF web ACL rules decide whether it gets there at all. Two failure modes recur in every tenant we have looked at:

1. **Rules that exist but can be stepped around.** ALB `path-pattern` matching is case-sensitive; a fixed-response 403 on `/admin/*` does not stop `/Admin/`. A WAF text match without `LOWERCASE` or `URL_DECODE` transforms is bypassed by casing or `%2f`. Both engines stop at the first match, so an Allow above a Block makes the Block unreachable for whatever the Allow covers.
2. **Rules that change without a record.** A managed rule group flipped to Count "for debugging" and never reverted; an IP set widened under `UpdateIPSet` without the web ACL itself changing; a listener rule renumbered during an incident.

The leadership ask that drove this module was explicit: *overall picture and direction, not every issue*. The deliverable is therefore a five-dimension posture band with trend arrows over a complete rule inventory, with the findings table as the drill-down rather than the headline.

## Data sources & access method
| Source | Calls (all read-only) | Notes |
|---|---|---|
| ELBv2 | DescribeLoadBalancers, DescribeListeners, DescribeRules, DescribeLoadBalancerAttributes | Attributes carry access-logging state and desync mode; invisible from the rule set alone |
| WAFv2 | ListWebACLs, GetWebACL, ListResourcesForWebACL, GetLoggingConfiguration, GetIPSet, GetRegexPatternSet, GetRuleGroup | `GetWebACL` is **denied under AWSReadOnlyAccess**; use SecurityAudit extended with `wafv2:GetIPSet` |
| AWS Config | ListDiscoveredResources (includeDeletedResources), GetResourceConfigHistory | Backfills the change ledger from before the control-plane's first sweep |
| CloudTrail (local events table) | already collected by the CloudTrail connector | Attributes a change to the nearest write call that names the resource |

Credential model: one config entry per account, each choosing named SSO profile, AssumeRole, or ambient chain; credentials re-resolved per run with the SDK file cache disabled so a re-login is picked up without restarting the server. Narrow-role entries that cover an account another entry already covers in full should carry a `skipServices` list, or they generate guaranteed access-denied noise that reads like a real gap.

Ship a **permission probe script** that exercises every call the sweep needs against a profile and prints ALLOW/DENIED per action. That list is what you hand to whoever owns the permission set.

## Collection tactics
- **Normalize to one shape, hash the raw.** Flatten SDK responses into `AlbFacts` (listeners → rules → conditions/actions) and `WafAclFacts` (rules → action/overrideAction/statementKind/matchFields/transforms/overrides/refs). The hygiene analyzer and the Config backfill read *only* these shapes, so a body seen live and one reconstructed from a Config item hash identically when the rules are the same. But change detection hashes the **raw WAF statement**, not the normalized summary: the summary collapses a GeoMatch country list, a rate limit and an IP set ARN into a "kind", and a country added to an allow-list produced no CHANGED row until this was fixed.
- **Collect the referenced sets.** IP sets, regex pattern sets and customer rule groups *are* the rule — an allow-list of vendor IPs is a hole exactly as wide as that list — and they change under `UpdateIPSet` without the web ACL changing. Record `entriesReadable=false` when the role can list but not read a set; empty is not the same as none.
- **Fault-isolate every collector.** A role that can describe load balancers but not web ACLs should still yield the half it is entitled to. Each denied call appends to `result.denied`; the sweep status becomes `partial`. Session/credential errors stay fatal.
- **Match credential failures on the error NAME, not the message.** The SDK name is `ExpiredTokenException`; the message is "The security token included in the request is expired" — no shared substring. Matching text alone made an expired mid-sweep session look like a permission denial, the sweep continued with empty collections, and the snapshot retired every production resource as GONE.
- **Refuse to snapshot when every collector came back empty and something was denied.** An account that returns nothing because one call failed is indistinguishable from an account with nothing in it; the guard prevents a false mass-retirement.
- Three things are written per sweep: the resource ledger (NEW/CHANGED/GONE via a tracked `rulesHash`), a **versions table** holding the full rule body per distinct version (what makes a change *reviewable*, not just detectable), and the findings table.

## Normalization & joins
- Join ALB → web ACL by association ARN both ways so an ACL protecting nothing (`WAF_ORPHAN`) and an internet-facing ALB with no ACL (`ALB_NO_WAF`) both surface.
- `applySnapshot` must skip a TRACKED-field diff when the field is absent from the prior summary (`field in prev`). Without that, adding any new summary field turns every resource into a fake CHANGED row on the next sweep.
- **Version dedupe is scoped by source and by time.** Insert a version only when the body differs from the newest version *at or before* its capture time, and only compare api-sourced bodies with api-sourced bodies. Config's ALB item records listeners but not listener rules, so an api body and a config body for the same ALB are different views, not an edit.
- AWS Config addresses both `AWS::WAFv2::WebACL` and `AWS::ElasticLoadBalancingV2::LoadBalancer` **by ARN, not by GUID id** (the id returns ResourceNotDiscoveredException). Config also normalizes key casing inconsistently across resource types (`rules` vs `Rules`), so read every property through a case-insensitive accessor.
- **The Config coverage gap.** A WebACL configuration item carries the full `Rules` array, so WAF rule-level history from Config is real and reaches back as far as the recorder does. A LoadBalancer item carries the LB and its listeners, **not listener rules**. Config therefore dates LB/listener changes only; ALB rule-level history starts at your first sweep. Say so in the UI and in every result note. Workaround: sweep frequently (rule-body versions are cheap), and attribute ALB rule edits from CloudTrail `ModifyRule`/`SetRulePriorities` events rather than from Config diffs.
- **Attribution:** the newest CloudTrail event on an edge write API (`UpdateWebACL`, `UpdateIPSet`, `ModifyRule`, `ModifyLoadBalancerAttributes`, …) that names the resource within a window before the capture time. Attribution is only as complete as CloudTrail collection; label it as such.

**Pseudo-SQL for the two load-bearing queries**

```sql
-- version dedupe: compare against the newest version at or before this capture, same source
SELECT body_hash FROM edge_versions
 WHERE resource_key = :arn AND source = :source AND captured_at <= :captured_at
 ORDER BY captured_at DESC LIMIT 1;
-- insert only when :new_hash differs (or no row)

-- change discipline: reviewed vs unreviewed changes in the watch window
SELECT COUNT(*)                                         AS total,
       SUM(CASE WHEN r.change_id IS NULL THEN 1 END)    AS unreviewed,
       MIN(CASE WHEN r.change_id IS NULL THEN c.observed_at END) AS oldest_unreviewed
  FROM changes c LEFT JOIN change_reviews r ON r.change_id = c.id
 WHERE c.service = 'edge' AND c.account = :account AND c.observed_at >= :window_start;
```

## Signals & finding rules
Every finding states the **mechanism**, not just the fact. "Priority 40 is shadowed by priority 10" is only actionable if it says why.

| Code | Severity | Rule |
|---|---|---|
| ALB_NO_WAF | high | internet-facing ALB with no web ACL association |
| ALB_NO_ACCESS_LOGS | high (internet-facing) / medium | access logging attribute off while listeners exist; WAF logging only covers what the ACL evaluated |
| ALB_HTTP_NO_REDIRECT | medium | port-80 HTTP listener whose default action is not a redirect |
| ALB_WEAK_TLS | medium | SSL policy permits TLS 1.0/1.1 (legacy `ELBSecurityPolicy-2016-08`, `-TLS-1-0`, `-TLS-1-1`) |
| ALB_DENY_CASE_SENSITIVE | high | fixed-response 4xx/5xx rule with a lowercase path pattern and no case variant — bypass by capitalising one letter |
| ALB_PATH_MIXED_CASE | high if deny rule, else low | path pattern contains uppercase; the lowercase form routes differently |
| ALB_RULE_SHADOWED | high if the later rule denies, else medium | an earlier (lower-numbered) rule's path *and* host conditions subsume a later rule's; the later never fires. Skip rules with other condition types (query, header, method) — subsumption is uncertain |
| ALB_PRIORITY_PACKED | low | ≥4 rules numbered consecutively; the next insert forces a renumber |
| WAF_ORPHAN | low | web ACL with no associations |
| WAF_NO_LOGGING | medium | no logging configuration |
| WAF_BLOCKS_NOTHING | high | default Allow and no rule in Block / override None / RateBased |
| WAF_NO_RATE_LIMIT | low | no rate-based statement |
| WAF_GROUP_COUNT_OVERRIDE | high | managed rule group `overrideAction=Count` — the usual shape of an unreverted debugging change |
| WAF_RULE_ACTION_OVERRIDE | medium | individual rules inside a managed group overridden to Count; confirm the false-positive reason is recorded and still true |
| WAF_RULE_COUNT_MODE | medium | leaf rule `action=Count` |
| WAF_NO_LOWERCASE_TRANSFORM | high if Block, else medium | text-match statement (ByteMatch, Regex*, Sqli, Xss, Size) on a field with no LOWERCASE transform |
| WAF_NO_URL_DECODE | medium if Block, else low | same statements without URL_DECODE |
| WAF_ALLOW_ON_FORGEABLE_FIELD | high | an Allow above the first enforcing rule keyed on a client-controlled field (headers, cookies, query, body, URI path, method) — anyone who reads or guesses the rule can claim the exception |
| WAF_ALLOW_ABOVE_BLOCK | medium | Allow above enforcing rules keyed on something the caller cannot choose (IP set, geo); include the set's entry count and days unchanged |
| WAF_PRIORITY_PACKED | low | ≥4 consecutive priorities |

Deliberate exclusions: conditional **redirects are not deny rules**. ELBv2 reports them as `HTTP_301`, and in practice they are version routing; treating them as gates invents bypass findings. Only fixed-response 4xx/5xx counts.

**Posture band** — five dimensions, each 0–100 with the counts that produced it shown alongside (a precise-looking number nobody can audit is worse than a rough one with its working shown):

| Dimension | Question | Score |
|---|---|---|
| Exposure | How many internet-facing front doors have a WAF? | protected ÷ internet-facing ALBs |
| Bypass risk | How much of the rule set can be stepped around? | 100 − (20 × high bypass findings + 6 × medium), floor 0 |
| Enforcement | Of the WAF rules that exist, how many block rather than count? | (rules − count-mode) ÷ rules |
| Evidence | If something got through, is there a record? | (ALBs + ACLs logging) ÷ (ALBs + ACLs) |
| Change discipline | Are rule changes reviewed? | reviewed ÷ changes observed in the watch window |

Trend = delta against the last snapshot at least 24 h old (±2 is flat). Persist posture **once per sweep, never per page view**, or page loads manufacture snapshot history and flatten the signal. A first sweep scores Change discipline as `null` (shown as "—"), not 100: no change history is an absence of evidence, not a record of restraint, and the headline names the real watch window ("the 3 days we have been watching") rather than claiming 90 days.

## Analyst triage & evidence
- **Change reviews table**: every ledger change can carry a note or ticket reference; unreviewed changes feed the Discipline score and the oldest-unreviewed age goes in the headline.
- **Standing exceptions age.** Compute days since a resource's rule body last changed and put it in the finding: an allow-list that has not moved in a year is a standing exception, whatever it was opened for.
- The findings table is the drill-down; the posture band is what goes to leadership. Export JSON of inventory + findings + posture per sweep; snapshot and delta per the datasets standard.
- AI analyst (optional) interprets posture + findings under the terse contract — one headline on direction, facts with counts, next steps as verbs — and never re-grades a rule.
- Requested but not yet built: real-time alerting on `UpdateWebACL` / `UpdateIPSet` / `ModifyLoadBalancerAttributes` from the CloudTrail rail. The ledger shows the change at the next sweep; alerting would show it at the minute.

**Evidence shape per sweep** (what the dataset export carries):
- `resources[]` — ALBs, web ACLs and sets with scheme, association, logging, rule count, rules hash
- `findings[]` — code, severity, rule reference, title, mechanism detail
- `posture[]` — five dimensions with score, headline, facts, delta, since, trend
- `changes[]` — ledger rows with the rule-level diff (added / removed / modified per rule key), attribution, review note
- `coverage` — denied calls per account/region, sweep status (`ok` / `partial`), first-sweep timestamp (the watch window)

## Pitfalls & lessons learned
- SecurityAudit vs ReadOnly: neither was a superset before the IP-set grant. SecurityAudit lacked CloudWatch metric reads (which other sweeps need); ReadOnly denied `wafv2:GetWebACL`, Bedrock listing and Secrets Manager listing. Probe before assuming.
- Expired-token false positive retiring the whole estate (above). Both the name-match fix and the empty-and-denied guard are load-bearing.
- A normalized summary hid real changes (geo lists, rate limits, set ARNs). Hash raw.
- New summary field → fake CHANGED on every resource. Guard the diff with `field in prev`.
- Never run a production build while the dev server is up on the same `.next` directory; it 500s the running server.
- zsh does not word-split unquoted variables; CLI flag bundles in shell variables silently break probe scripts. Write flags inline.

## Do not
- Do not promise Config-based rule history for ALBs. It does not exist.
- Do not score a first sweep as 100 on any dimension that needs history.
- Do not treat redirects as deny rules, or rules with query/header/method conditions as shadowable.
- Do not persist posture from a reader path; only the sweep writes snapshots.
- Do not mark resources GONE from a sweep that had any collector denied and nothing collected.
- Do not read secret or set *contents* beyond what the finding needs (entry count, age); never log IP set entries into findings text.

## Related steering files
- foundation-control-plane-architecture — accounts config, sweeps, resource ledger
- foundation-evidence-datasets-snapshots — export/snapshot/delta pattern the posture band uses
- foundation-ai-analyst-triage — terse output contract
- monitoring-aws-cloudtrail — the events rail used for change attribution
- analysis-aws-iam-admins — companion AWS read-model; same credential and probe discipline
- analysis-pentest-cadence — external validation of the same front doors
