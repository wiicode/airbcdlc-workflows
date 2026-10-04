// Load program records from disk. Supports YAML front-matter Markdown (.md), plain YAML (.yaml/.yml), JSON (.json).
// The structured record is the front-matter / document body; Markdown prose after the fence is human context.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import YAML from "yaml";
import { RECORD_DIRS, BRANCH_ID, PARENT_ID } from "./paths.ts";

export interface LoadedRecord {
  type: string; // schema slug
  id: string; // the record's own id (from the data, else the filename)
  dir: string; // relative dir it was found in
  file: string; // absolute path
  data: any; // the structured record
  prose: string; // markdown body after front-matter, if any
}

const FRONT = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseFile(file: string): { data: any; prose: string } {
  const raw = readFileSync(file, "utf8");
  const ext = extname(file).toLowerCase();
  if (ext === ".json") return { data: JSON.parse(raw), prose: "" };
  if (ext === ".yaml" || ext === ".yml") return { data: YAML.parse(raw), prose: "" };
  // .md: front-matter or whole-file YAML
  const m = raw.match(FRONT);
  if (m) return { data: YAML.parse(m[1]), prose: (m[2] || "").trim() };
  return { data: YAML.parse(raw), prose: "" };
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "README.md") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(md|ya?ml|json)$/i.test(name)) out.push(p);
  }
  return out;
}

export function resolveType(relDir: string, data: any): string | null {
  // longest matching configured dir prefix
  let best: string | null = null;
  for (const key of Object.keys(RECORD_DIRS)) {
    if (relDir === key || relDir.startsWith(key + "/")) {
      if (!best || key.length > best.length) best = key;
    }
  }
  if (!best) return null;
  const t = RECORD_DIRS[best];
  if (t === "risk") {
    const id = String(data?.id ?? "");
    if (BRANCH_ID.test(id)) return "risk-branch";
    if (PARENT_ID.test(id)) return "risk-parent";
    return data?.parent ? "risk-branch" : "risk-parent";
  }
  return t;
}

export function loadAll(root: string): LoadedRecord[] {
  const records: LoadedRecord[] = [];
  for (const dirKey of Object.keys(RECORD_DIRS)) {
    const abs = join(root, dirKey);
    for (const file of walk(abs)) {
      const relDir = relative(root, file).split("/").slice(0, -1).join("/");
      const { data, prose } = parseFile(file);
      const type = resolveType(relDir, data);
      if (!type) continue;
      const id = String(data?.id ?? data?.code ?? data?.slug ?? basename(file).replace(/\.(md|ya?ml|json)$/i, ""));
      records.push({ type, id, dir: relDir, file, data, prose });
    }
  }
  // sources registry (single file)
  for (const sp of ["inventory/sources.yaml", "inventory/sources.yml", "sources.yaml"]) {
    const abs = join(root, sp);
    if (existsSync(abs)) {
      const { data } = parseFile(abs);
      records.push({ type: "sources", id: "sources", dir: sp.split("/").slice(0, -1).join("/"), file: abs, data, prose: "" });
    }
  }
  return records;
}

export function index(records: LoadedRecord[]) {
  const byType: Record<string, LoadedRecord[]> = {};
  const byId: Record<string, LoadedRecord> = {};
  for (const r of records) {
    (byType[r.type] ??= []).push(r);
    byId[r.id] = r;
  }
  return { byType, byId };
}
