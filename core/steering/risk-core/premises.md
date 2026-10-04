<!-- scope: steering · risk-core · premises. How a decision carries its grounds and re-opens when they move. -->
# Premises — why a decision re-opens itself

A decision is not a timestamp on a disposition; it is a claim that rests on specific, written-down grounds. Those grounds are its **premises**. When a premise moves, the decision is no longer the same decision, and it re-opens.

This is how the harness makes good on "risk evaluation is present in every stage" without re-running the whole assessment every time: the decision remembers what it assumed, and a cheap sensor checks those assumptions at every later gate.

## What a premise is

Each premise on a decision records one grounding fact and its value at decision time:

| Kind | `ref` | `state` (value at decision time) |
| --- | --- | --- |
| `inventory-fact` | `<slug>.<field>` | the field's value then (e.g. `acme-vendor.oversight = signed`) |
| `control-state` | `<CONTROL-CODE>` | the control's health or coverage then (e.g. `WS1 = healthy`) |
| `tolerance` | `<T-id>` | the tolerance sentence then |
| `scenario` | `<S-id>` | the illustration the decision leaned on |
| `obligation` | `<O-id>` | the obligation's disposition then |
| `external` | free ref | a stated external condition |

A decision with no premises is incomplete — it rests on something; name it.

## The re-open

The `premise-moved` sensor runs at every gate. For each premise it reads the current value and compares it to the recorded `state`. If they differ, it surfaces the decision for re-open, with the reason stated as `"<kind> <ref>: <old> → <new>"`. The re-open is **recorded as an audit line** on the decision (`reopened[]`), never a silent overwrite. A human then confirms the disposition still holds, or changes it.

Worked example: a branch is **Accept**ed because `acme-vendor.oversight = signed` and `WS1 = healthy`. Three months later the vendor relationship lapses (`oversight → blocked`). `premise-moved` fires; the Accept re-opens with `inventory-fact acme-vendor.oversight: "signed" → "blocked"`; the business owner re-decides. The decision never quietly rotted.

## Where premises come from

- The `risk-assessor` names them while proposing the breakdown.
- The `business-owner` tests them in review (an unverifiable premise is a weak decision).
- The engine resolves them against live records at every gate.

This generalizes a field-practice "evidence-mask" pattern: a conclusion is valid only while the evidence under it holds, and the system knows when it stops holding.

## What this is not

Not version control of the whole record — git already does that. Premises are the *load-bearing subset* a decision depends on, chosen deliberately, so the re-open sensor is cheap and the reason is legible. Not an automatic re-decision — the sensor re-opens; a human re-decides.
