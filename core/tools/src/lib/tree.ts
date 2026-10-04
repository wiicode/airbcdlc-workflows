// The one tree. Resolves any node up to a root harm, or prints a harm's subtree down to tools.
import { loadAll, index, type LoadedRecord } from "./records.ts";

export interface Model {
  records: LoadedRecord[];
  byType: Record<string, LoadedRecord[]>;
  byId: Record<string, LoadedRecord>;
  // quick lookups
  harms: Map<string, any>;
  tolerances: Map<string, any>;
  parents: Map<string, any>;
  branches: Map<string, any>;
  controlsLib: Map<string, any>;
  controlsImpl: Map<string, any>;
  systems: Map<string, any>;
}

export function build(root: string): Model {
  const records = loadAll(root);
  const { byType, byId } = index(records);
  const asMap = (t: string, key: string) => {
    const m = new Map<string, any>();
    for (const r of byType[t] ?? []) m.set(String(r.data?.[key] ?? r.id), r.data);
    return m;
  };
  return {
    records, byType, byId,
    harms: asMap("harm", "id"),
    tolerances: asMap("tolerance", "id"),
    parents: asMap("risk-parent", "id"),
    branches: asMap("risk-branch", "id"),
    controlsLib: asMap("control-library", "code"),
    controlsImpl: asMap("control-implementation", "code"),
    systems: asMap("inventory-system", "slug"),
  };
}

export type NodeKind =
  | "harm" | "intermediate" | "parent" | "branch" | "control" | "system" | "tolerance" | "unknown";

export function classify(m: Model, id: string): NodeKind {
  if (m.harms.has(id)) return "harm";
  if (m.tolerances.has(id)) return "tolerance";
  if (m.parents.has(id)) return "parent";
  if (m.branches.has(id)) return "branch";
  if (m.controlsLib.has(id) || m.controlsImpl.has(id)) return "control";
  if (m.systems.has(id)) return "system";
  // intermediate vocabulary term?
  for (const p of m.parents.values()) if (p.intermediate_harm === id) return "intermediate";
  for (const c of m.controlsLib.values()) if ((c.prevents ?? []).includes(id)) return "intermediate";
  return "unknown";
}

// Walk UP from any node to the root harm(s). Returns ordered chain lines (bottom → top).
export function traceUp(m: Model, id: string): { kind: NodeKind; lines: string[]; harm?: string } {
  const kind = classify(m, id);
  const lines: string[] = [];
  let topHarm: string | undefined;

  const emitControl = (code: string, indent: string) => {
    const lib = m.controlsLib.get(code);
    const impl = m.controlsImpl.get(code);
    const title = lib?.title ?? code;
    const prev = (lib?.prevents ?? []).join(", ");
    const pct = impl ? ` [${impl.implementation_pct}% ${impl.coverage}${impl.health ? "/" + impl.health : ""}]` : "";
    lines.push(`${indent}control    ${code} ${title}${pct}`);
    if (prev) lines.push(`${indent}  prevents  ${prev}`);
  };

  const emitBranchUp = (bid: string, indent = "") => {
    const b = m.branches.get(bid);
    if (!b) { lines.push(`${indent}branch     ${bid} (not found)`); return; }
    const disp = b.disposition ? ` — ${b.disposition}` : " — (undecided)";
    lines.push(`${indent}branch     ${bid} ${b.statement}${disp}  [owner: ${b.owner ?? "—"}]`);
    for (const c of b.controls ?? []) emitControl(c, indent + "  ");
    const p = m.parents.get(b.parent);
    if (p) {
      lines.push(`${indent}parent     ${b.parent} ${p.statement}`);
      lines.push(`${indent}  mechanism ${p.mechanism}`);
      // a branch may roll up to its own harm when it differs from the parent's
      const eInt = b.intermediate_harm ?? p.intermediate_harm;
      const eTop = b.top_harm ?? p.top_harm;
      const crosses = b.top_harm && b.top_harm !== p.top_harm;
      lines.push(`${indent}intermediate ${eInt}${crosses ? "  (branch crosses from parent)" : ""}`);
      const h = m.harms.get(eTop);
      lines.push(`${indent}top-harm   ${eTop} ${h?.title ?? ""}${crosses ? "  ← this branch backs out here, not to " + p.top_harm : ""}`);
      topHarm = eTop;
      emitTolerances(eTop, indent + "  ");
    }
  };

  const emitTolerances = (hid: string, indent: string) => {
    for (const t of m.tolerances.values()) {
      if (t.harm === hid) lines.push(`${indent}tolerance ${t.id}: ${t.statement}`);
    }
  };

  switch (kind) {
    case "system": {
      const s = m.systems.get(id);
      lines.push(`tool       ${id} ${s?.name ?? ""}`);
      const impls = s?.implements ?? [];
      if (!impls.length) lines.push(`  (implements no control — orphan tool)`);
      for (const code of impls) {
        emitControl(code, "  ");
        // find branches that use this control
        for (const [bid, b] of m.branches) if ((b.controls ?? []).includes(code)) emitBranchUp(bid, "    ");
      }
      break;
    }
    case "control": {
      emitControl(id, "");
      for (const [bid, b] of m.branches) if ((b.controls ?? []).includes(id)) emitBranchUp(bid, "  ");
      break;
    }
    case "branch":
      emitBranchUp(id, "");
      break;
    case "parent": {
      const p = m.parents.get(id);
      lines.push(`parent     ${id} ${p.statement}`);
      lines.push(`  mechanism ${p.mechanism}`);
      lines.push(`intermediate ${p.intermediate_harm}`);
      const h = m.harms.get(p.top_harm);
      lines.push(`top-harm   ${p.top_harm} ${h?.title ?? ""}`);
      topHarm = p.top_harm;
      emitTolerances(p.top_harm, "  ");
      break;
    }
    case "harm": {
      const h = m.harms.get(id);
      lines.push(`top-harm   ${id} ${h?.title ?? ""}`);
      emitTolerances(id, "  ");
      topHarm = id;
      break;
    }
    case "tolerance": {
      const t = m.tolerances.get(id);
      lines.push(`tolerance  ${id}: ${t.statement}`);
      const h = m.harms.get(t.harm);
      lines.push(`  bounds   ${t.harm} ${h?.title ?? ""}`);
      topHarm = t.harm;
      break;
    }
    default:
      lines.push(`'${id}' is not a node on the tree. It may be an intake item, a finding, or a tool not yet in inventory.`);
  }
  return { kind, lines, harm: topHarm };
}

// Print DOWN from a harm.
export function treeDown(m: Model, harmId: string): string[] {
  const lines: string[] = [];
  const h = m.harms.get(harmId);
  if (!h) return [`no harm '${harmId}'`];
  lines.push(`${harmId}  ${h.title}`);
  for (const t of m.tolerances.values()) if (t.harm === harmId) lines.push(`  └ tolerance ${t.id}: ${t.statement}`);
  for (const [pid, p] of m.parents) {
    if (p.top_harm !== harmId) continue;
    lines.push(`  ├ ${pid} [${p.intermediate_harm}]  ${p.statement}`);
    for (const [bid, b] of m.branches) {
      if (b.parent !== pid) continue;
      const disp = b.disposition ?? "undecided";
      lines.push(`  │   ├ ${bid} (${disp}) ${b.statement}`);
      for (const c of b.controls ?? []) {
        const lib = m.controlsLib.get(c);
        const impl = m.controlsImpl.get(c);
        const pct = impl ? ` ${impl.implementation_pct}%/${impl.coverage}` : "";
        lines.push(`  │   │   └ control ${c}${pct} ${lib?.title ?? ""}`);
      }
    }
  }
  return lines;
}
