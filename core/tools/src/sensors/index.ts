// Deterministic sensors. Each returns hits in the CI shape: SEVERITY | sensor | file:line | detail.
// A sensor never mutates; it surfaces. "When unsure, do not mutate — surface it."
import type { Model } from "../lib/tree.ts";
import { classify } from "../lib/tree.ts";

export type Severity = "red" | "amber" | "info";
export interface Hit {
  sensor: string;
  severity: Severity;
  file: string;
  detail: string;
}

const SECURITY_OWNER = /\b(security|ciso|secops|soc|infosec|appsec)\b/i;
const HARM_SENTENCE = /\bbecause\b|\bwhen\b|\bafter\b|\bdue to\b/i;
const SLASH_DISPOSITION = /(mitigate|accept|avoid|transfer)\s*[\/|]\s*(mitigate|accept|avoid|transfer)/i;

function fileOf(m: Model, id: string): string {
  const r = m.byId[id];
  return r ? r.file.replace(/^.*\/(tests\/fixtures\/[^/]+\/.*)$/, "$1").replace(/^.*\/(.*\/[^/]+)$/, "$1") : id;
}

// inventory-by-slug across all inventory types, for premise resolution
function inventoryBySlug(m: Model): Map<string, any> {
  const map = new Map<string, any>();
  for (const t of ["inventory-system", "inventory-person", "inventory-device", "inventory-vendor", "inventory-access"]) {
    for (const r of m.byType[t] ?? []) map.set(String(r.data?.slug ?? r.id), r.data);
  }
  return map;
}

function getField(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

type SensorFn = (m: Model) => Hit[];

const sensors: Record<string, SensorFn> = {
  "harm-sentence": (m) => {
    const hits: Hit[] = [];
    for (const [id, p] of m.parents) {
      if (!HARM_SENTENCE.test(p.statement ?? "")) {
        hits.push({ sensor: "harm-sentence", severity: "red", file: fileOf(m, id),
          detail: `${id} is not a harm sentence ([who] suffers [what] because [condition]): "${p.statement}"` });
      }
    }
    return hits;
  },

  "single-response": (m) => {
    const hits: Hit[] = [];
    for (const [id, b] of m.branches) {
      const blob = `${b.statement ?? ""} ${b.disposition ?? ""} ${(m.byId[id]?.prose ?? "")}`;
      if (SLASH_DISPOSITION.test(blob)) {
        hits.push({ sensor: "single-response", severity: "red", file: fileOf(m, id),
          detail: `${id} carries more than one disposition ("mitigate / accept" hides an undeclared acceptance). Split the branch or use a named fallback in the decision.` });
      }
    }
    return hits;
  },

  "control-link": (m) => {
    const hits: Hit[] = [];
    for (const [id, b] of m.branches) {
      if (b.disposition === "mitigate" && !(b.controls ?? []).length) {
        hits.push({ sensor: "control-link", severity: "red", file: fileOf(m, id),
          detail: `${id} is Mitigate with no control link — a finding about the catalogue, not a decided branch.` });
      }
    }
    return hits;
  },

  "owner-outside-security": (m) => {
    const hits: Hit[] = [];
    for (const [id, b] of m.branches) {
      if (b.owner && SECURITY_OWNER.test(b.owner)) {
        hits.push({ sensor: "owner-outside-security", severity: "red", file: fileOf(m, id),
          detail: `${id} is owned by "${b.owner}" — the business owns the decision; security proposes. Reassign to the seat whose objective is harmed.` });
      }
    }
    return hits;
  },

  "tolerance-referenced": (m) => {
    const hits: Hit[] = [];
    for (const [id, p] of m.parents) {
      const harmHasTol = [...m.tolerances.values()].some((t) => t.harm === p.top_harm);
      if (!p.tolerance && !harmHasTol) {
        hits.push({ sensor: "tolerance-referenced", severity: "amber", file: fileOf(m, id),
          detail: `${id} compares to no tolerance (and ${p.top_harm} has none) — the missing governance input. Draft the sentence and name the executive.` });
      }
    }
    return hits;
  },

  "decision-complete": (m) => {
    const hits: Hit[] = [];
    for (const r of m.byType["decision"] ?? []) {
      const d = r.data;
      if (d.disposition === "accept" && !d.review_trigger) {
        hits.push({ sensor: "decision-complete", severity: "red", file: fileOf(m, d.id),
          detail: `${d.id} is an Accept with no review trigger (owner, date, review trigger are required for Accept).` });
      }
      if (d.disposition === "accept" && !d.authorized) {
        hits.push({ sensor: "decision-complete", severity: "red", file: fileOf(m, d.id),
          detail: `${d.id} is an Accept not authorized by a human — \`authorized\` is set only by a human action.` });
      }
      if (d.reversibility === "one-way-door" && !d.authorized) {
        hits.push({ sensor: "decision-complete", severity: "red", file: fileOf(m, d.id),
          detail: `${d.id} is a one-way door without explicit human authorization (a one-way door gets a pre-mortem and human approval).` });
      }
    }
    return hits;
  },

  "monitor-complete": (m) => {
    const hits: Hit[] = [];
    for (const r of m.byType["monitoring-proposal"] ?? []) {
      const mp = r.data;
      const b = m.branches.get(mp.branch);
      if (!b) {
        hits.push({ sensor: "monitor-complete", severity: "red", file: fileOf(m, mp.id),
          detail: `${mp.id} names branch ${mp.branch}, which does not exist. A monitor must attach to a real branch.` });
        continue;
      }
      if (!b.disposition) {
        hits.push({ sensor: "monitor-complete", severity: "amber", file: fileOf(m, mp.id),
          detail: `${mp.id} supports branch ${mp.branch}, which has no disposition yet — a monitor cannot stand in for the decision. Decide the branch first.` });
      }
      if (!mp.has_response_authority && mp.half === "pre-compromise") {
        hits.push({ sensor: "monitor-complete", severity: "amber", file: fileOf(m, mp.id),
          detail: `${mp.id} claims a pre-compromise effect without response authority — passive detection changes nothing about likelihood.` });
      }
    }
    return hits;
  },

  "finding-not-risk": (m) => {
    const hits: Hit[] = [];
    for (const r of m.byType["finding"] ?? []) {
      const f = r.data;
      if (!m.controlsLib.has(f.tests_control) && !m.controlsImpl.has(f.tests_control)) {
        hits.push({ sensor: "finding-not-risk", severity: "amber", file: fileOf(m, f.id),
          detail: `${f.id} tests control ${f.tests_control}, which is not in the catalogue.` });
      }
      if (/\bsuffers?\b/i.test(f.statement ?? "") && HARM_SENTENCE.test(f.statement ?? "")) {
        hits.push({ sensor: "finding-not-risk", severity: "red", file: fileOf(m, f.id),
          detail: `${f.id} is written as a harm sentence — a finding is evidence a control is not holding, not a risk. Route the harm to the register; keep the finding linked to its control.` });
      }
    }
    return hits;
  },

  "orphan-node": (m) => {
    const hits: Hit[] = [];
    // systems implementing nothing
    for (const [slug, s] of m.systems) {
      if (!(s.implements ?? []).length) {
        hits.push({ sensor: "orphan-node", severity: "info", file: fileOf(m, slug),
          detail: `tool ${slug} implements no control — it backs out to no harm. Wire it to a control or decide why it is here.` });
      }
    }
    // branches whose parent/control is missing
    for (const [id, b] of m.branches) {
      if (!m.parents.has(b.parent)) {
        hits.push({ sensor: "orphan-node", severity: "red", file: fileOf(m, id),
          detail: `${id} points at parent ${b.parent}, which does not exist — the branch backs out to nothing.` });
      }
      for (const c of b.controls ?? []) {
        if (!m.controlsLib.has(c)) {
          hits.push({ sensor: "orphan-node", severity: "red", file: fileOf(m, id),
            detail: `${id} links control ${c}, which is not in controls/library.` });
        }
      }
      if (b.top_harm && !m.harms.has(b.top_harm)) {
        hits.push({ sensor: "orphan-node", severity: "red", file: fileOf(m, id),
          detail: `${id} backs out to ${b.top_harm}, which is not a defined harm root.` });
      }
    }
    // parents whose top_harm is missing
    for (const [id, p] of m.parents) {
      if (!m.harms.has(p.top_harm)) {
        hits.push({ sensor: "orphan-node", severity: "red", file: fileOf(m, id),
          detail: `${id} rolls up to ${p.top_harm}, which is not a defined harm root.` });
      }
    }
    // library controls no branch treats with
    for (const [code, c] of m.controlsLib) {
      const used = [...m.branches.values()].some((b) => (b.controls ?? []).includes(code));
      if (!used) {
        hits.push({ sensor: "orphan-node", severity: "info", file: fileOf(m, code),
          detail: `control ${code} treats no branch — a control with no risk attached is a finding about the catalogue.` });
      }
    }
    return hits;
  },

  "premise-moved": (m) => {
    const hits: Hit[] = [];
    const inv = inventoryBySlug(m);
    for (const r of m.byType["decision"] ?? []) {
      const d = r.data;
      const alreadyReopened = new Set((d.reopened ?? []).map((x: any) => x.reason));
      for (const prem of d.premises ?? []) {
        let current: any;
        if (prem.kind === "control-state") {
          const impl = m.controlsImpl.get(prem.ref);
          current = impl ? (impl.health ?? impl.coverage ?? "unknown") : "missing";
        } else if (prem.kind === "inventory-fact") {
          const [slug, ...fieldParts] = String(prem.ref).split(".");
          const rec = inv.get(slug);
          current = rec ? getField(rec, fieldParts.join(".")) : "missing";
        } else if (prem.kind === "tolerance") {
          const t = m.tolerances.get(prem.ref);
          current = t ? t.statement : "missing";
        } else {
          continue;
        }
        if (current !== undefined && String(current) !== String(prem.state)) {
          const reason = `${prem.kind} ${prem.ref}: "${prem.state}" → "${current}"`;
          if (!alreadyReopened.has(reason)) {
            hits.push({ sensor: "premise-moved", severity: "red", file: fileOf(m, d.id),
              detail: `${d.id} rests on ${reason}. Re-open the decision — a premise moved.` });
          }
        }
      }
    }
    return hits;
  },

  "residual-from-control-health": (m) => {
    const hits: Hit[] = [];
    for (const [id, b] of m.branches) {
      if (b.disposition !== "mitigate") continue;
      for (const c of b.controls ?? []) {
        const impl = m.controlsImpl.get(c);
        if (impl && (impl.health === "failing" || impl.health === "degraded")) {
          const noted = (b.residual?.note ?? "").toLowerCase().includes(impl.health);
          if (!noted) {
            hits.push({ sensor: "residual-from-control-health", severity: "amber", file: fileOf(m, id),
              detail: `${id} is Mitigate resting on control ${c} (${impl.health}) — a mitigated risk on a failing control is quietly back toward inherent. Recompute residual.` });
          }
        }
      }
    }
    return hits;
  },
};

export const SENSOR_NAMES = Object.keys(sensors);

export function runSensors(m: Model, only?: string[]): Hit[] {
  const names = only?.length ? only : SENSOR_NAMES;
  const hits: Hit[] = [];
  for (const n of names) {
    const fn = sensors[n];
    if (fn) hits.push(...fn(m));
  }
  // red first, then amber, then info
  const order = { red: 0, amber: 1, info: 2 } as const;
  return hits.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function formatHit(h: Hit): string {
  return `${h.severity.toUpperCase().padEnd(5)} | ${h.sensor.padEnd(26)} | ${h.file} | ${h.detail}`;
}
