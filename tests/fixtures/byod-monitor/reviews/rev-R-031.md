---
subject: R-031 breakdown (from 'we'll monitor BYOD')
reviewer: business-owner
failure_modes_tested:
  - mode: Monitor offered as the answer to the parent
    result: Rejected — M-0007 placed post-compromise on R-031a only; parent still requires decisions on a–d
    evidence: M-0007.supports_decision names a branch, not the parent
  - mode: Branch d implausible for this company
    result: Held — inventory shows a remote contractor with identity_verified_at_hire=no and BYOD access
    evidence: inventory/people/contractor-remote-01
  - mode: Monitor claimed to reduce likelihood
    result: Held — has_response_authority=false; placed post-compromise
    evidence: M-0007
top_problem: Identity verification at hire (IDV1) is only 30% implemented; branch d's Avoid rests on a control not yet in place.
confidence: high
verdict: accept-with-conditions
conditions:
  - IDV1 reaches managed state before R-031d is considered treated
circuit_breaker: { cycles: 1, tripped: false }
provenance: { source: fixture byod-monitor, added: 2026-10-03, updated: 2026-10-03 }
---
