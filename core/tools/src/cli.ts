#!/usr/bin/env bun
// rbc — the AI-RBC-DLC engine. Small by design. stdout for humans; `--json` where a machine reads.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { HARNESS_ROOT } from "./lib/paths.ts";
import { loadAll } from "./lib/records.ts";
import { validateRecord } from "./lib/schema.ts";
import { build, traceUp, treeDown } from "./lib/tree.ts";
import { runSensors, formatHit, SENSOR_NAMES, type Hit } from "./sensors/index.ts";
import { init } from "./commands/init.ts";
import { lint } from "./commands/lint.ts";
import { leaktest } from "./commands/leaktest.ts";

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const has = (name: string) => argv.includes(`--${name}`);
const rootArg = () => flag("root") ?? process.cwd();

function die(msg: string, code = 1): never { console.error(msg); process.exit(code); }

// ---- validate ---------------------------------------------------------------
function cmdValidate(root: string): number {
  const records = loadAll(root);
  if (!records.length) { console.log(`no records under ${root}`); return 0; }
  let errors = 0;
  for (const r of records) {
    const errs = validateRecord(r.type, r.data);
    for (const e of errs) {
      errors++;
      console.log(`SCHEMA | ${r.type} | ${relative(root, r.file)} | ${e.path} ${e.message}`);
    }
  }
  console.log(errors ? `\n${errors} schema error(s) across ${records.length} record(s).`
                     : `ok — ${records.length} record(s) valid.`);
  return errors ? 1 : 0;
}

// ---- trace / tree -----------------------------------------------------------
function cmdTrace(root: string, id: string) {
  const m = build(root);
  const { kind, lines, harm } = traceUp(m, id);
  console.log(`trace ${id}  (${kind})`);
  console.log(lines.map((l) => "  " + l).join("\n"));
  if (harm) console.log(`\n  → backs out to ${harm}`);
}
function cmdTree(root: string, harm: string) {
  const m = build(root);
  console.log(treeDown(m, harm).join("\n"));
}

// ---- sensors ----------------------------------------------------------------
function cmdSensors(root: string): number {
  const m = build(root);
  const only = flag("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const hits = runSensors(m, only);
  for (const h of hits) console.log(formatHit(h));
  const reds = hits.filter((h) => h.severity === "red").length;
  const ambers = hits.filter((h) => h.severity === "amber").length;
  const infos = hits.filter((h) => h.severity === "info").length;
  console.log(`\n${reds} red · ${ambers} amber · ${infos} info  (${(only ?? SENSOR_NAMES).length} sensors)`);
  return reds ? 1 : 0;
}

// ---- graph compile --check --------------------------------------------------
function cmdGraph(): number {
  const stagesDir = join(HARNESS_ROOT, "core/stages");
  if (!existsSync(stagesDir)) { console.log("no core/stages/ yet."); return 0; }
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".md") && basename(p) !== "README.md") files.push(p); } };
  walk(stagesDir);
  const FRONT = /^---\n([\s\S]*?)\n---/;
  const stages = new Map<string, { requires: string[]; phase?: string; file: string }>();
  let errs = 0;
  for (const f of files) {
    const m = readFileSync(f, "utf8").match(FRONT);
    if (!m) { console.log(`GRAPH | stage | ${relative(HARNESS_ROOT, f)} | no YAML front-matter`); errs++; continue; }
    // ultra-light YAML: id, phase, requires:[a,b]
    const idM = m[1].match(/^id:\s*(.+)$/m);
    const phM = m[1].match(/^phase:\s*(.+)$/m);
    const rqM = m[1].match(/^requires:\s*\[([^\]]*)\]/m);
    if (!idM) { console.log(`GRAPH | stage | ${relative(HARNESS_ROOT, f)} | no id`); errs++; continue; }
    const id = idM[1].trim();
    const requires = rqM ? rqM[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
    stages.set(id, { requires, phase: phM?.[1].trim(), file: f });
  }
  for (const [id, s] of stages) for (const dep of s.requires)
    if (!stages.has(dep)) { console.log(`GRAPH | ${id} | ${relative(HARNESS_ROOT, s.file)} | requires '${dep}', which is not a stage`); errs++; }
  // cycle check
  const WHITE = 0, GRAY = 1, BLACK = 2; const color = new Map<string, number>();
  let cycle = false;
  const dfs = (id: string) => { color.set(id, GRAY);
    for (const d of stages.get(id)?.requires ?? []) {
      if (!stages.has(d)) continue;
      const c = color.get(d) ?? WHITE;
      if (c === GRAY) { cycle = true; console.log(`GRAPH | cycle | | ${id} → ${d}`); }
      else if (c === WHITE) dfs(d);
    }
    color.set(id, BLACK); };
  for (const id of stages.keys()) if ((color.get(id) ?? WHITE) === WHITE) dfs(id);
  console.log(cycle || errs ? `\ngraph NOT clean (${errs} error(s)${cycle ? ", cycle present" : ""}).`
                            : `ok — ${stages.size} stage(s), graph acyclic.`);
  return cycle || errs ? 1 : 0;
}

// ---- check (composite CI) ---------------------------------------------------
function cmdCheck(): number {
  let fail = 0;
  const section = (t: string) => console.log(`\n=== ${t} ===`);

  section("lint (core steering + personas)");
  const lintHits = lint(HARNESS_ROOT);
  for (const h of lintHits) console.log(formatHit(h));
  const lintReds = lintHits.filter((h) => h.severity === "red").length;
  console.log(`${lintReds} red · ${lintHits.length - lintReds} amber/info`);
  fail += lintReds ? 1 : 0;

  section("leak-test (no author program in shipped core)");
  const { hits: leakHits, scanned } = leaktest(HARNESS_ROOT);
  for (const h of leakHits) console.log(formatHit(h));
  console.log(`${leakHits.length} leak(s) across ${scanned} file(s).`);
  fail += leakHits.length ? 1 : 0;

  section("graph compile --check");
  fail += cmdGraph();

  const fxRoot = join(HARNESS_ROOT, "tests/fixtures");
  if (existsSync(fxRoot)) {
    for (const name of readdirSync(fxRoot)) {
      if (name.startsWith("_") || name.startsWith(".")) continue; // helper/mutant dirs are driven by bun test, not CI
      const dir = join(fxRoot, name);
      if (!statSync(dir).isDirectory()) continue;
      section(`fixture ${name} — validate`);
      fail += cmdValidate(dir);
      section(`fixture ${name} — sensors`);
      const m = build(dir);
      const hits = runSensors(m);
      for (const h of hits) console.log(formatHit(h));
      const expPath = join(dir, "expect.json");
      if (existsSync(expPath)) fail += checkExpect(expPath, hits, m, dir);
    }
  }

  console.log(fail ? `\nCHECK FAILED (${fail} failing section(s)).` : `\nCHECK PASSED.`);
  return fail ? 1 : 0;
}

// fixtures declare what the harness should have produced
function checkExpect(expPath: string, hits: Hit[], m: ReturnType<typeof build>, dir: string): number {
  const exp = JSON.parse(readFileSync(expPath, "utf8"));
  let bad = 0;
  const names = new Set(hits.map((h) => h.sensor));
  for (const s of exp.sensors_fire ?? []) {
    if (!names.has(s)) { console.log(`EXPECT | ${basename(dir)} | ${expPath} | expected sensor '${s}' to fire, it did not`); bad++; }
  }
  for (const s of exp.sensors_silent ?? []) {
    if (names.has(s)) { console.log(`EXPECT | ${basename(dir)} | ${expPath} | expected sensor '${s}' silent, it fired`); bad++; }
  }
  for (const t of exp.traces ?? []) {
    const { harm } = traceUp(m, t.node);
    const got = harm ?? null;
    const want = t.harm ?? null;
    if (got !== want) { console.log(`EXPECT | ${basename(dir)} | ${expPath} | trace ${t.node} → ${got ?? "(none)"}, expected ${want ?? "(none)"}`); bad++; }
  }
  if (!bad) console.log(`expectations met (${(exp.sensors_fire ?? []).length} fire, ${(exp.sensors_silent ?? []).length} silent, ${(exp.traces ?? []).length} trace).`);
  return bad ? 1 : 0;
}

// ---- dispatch ---------------------------------------------------------------
const [cmd, sub] = argv;
switch (cmd) {
  case "init": {
    const made = init(process.cwd());
    console.log(made.length ? `rbc init — created:\n  ${made.join("\n  ")}` : "rbc init — nothing to do (already initialized).");
    break;
  }
  case "validate": process.exit(cmdValidate(rootArg())); break;
  case "trace": {
    const id = argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
    if (!id) die("usage: rbc trace <node> [--root DIR]");
    cmdTrace(rootArg(), id); break;
  }
  case "tree": {
    const h = argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
    if (!h) die("usage: rbc tree <harm> [--root DIR]");
    cmdTree(rootArg(), h); break;
  }
  case "sensors": process.exit(cmdSensors(rootArg())); break;
  case "lint": {
    const hits = lint(HARNESS_ROOT);
    for (const h of hits) console.log(formatHit(h));
    const reds = hits.filter((h) => h.severity === "red").length;
    console.log(`\n${reds} red · ${hits.length - reds} amber/info`);
    process.exit(reds ? 1 : 0);
  }
  case "leak-test": {
    const { hits, scanned } = leaktest(HARNESS_ROOT);
    for (const h of hits) console.log(formatHit(h));
    console.log(`\n${hits.length} leak(s) across ${scanned} file(s).`);
    process.exit(hits.length ? 1 : 0);
  }
  case "graph": {
    if (sub !== "compile") die("usage: rbc graph compile --check");
    process.exit(cmdGraph());
  }
  case "check": process.exit(cmdCheck()); break;
  case "sensors-list": console.log(SENSOR_NAMES.join("\n")); break;
  default:
    console.log(`rbc — AI-RBC-DLC engine (M0)
usage:
  rbc init                         scaffold a program repo here
  rbc validate [--root DIR]        schema-validate every record
  rbc trace <node> [--root DIR]    walk a node up to its root harm
  rbc tree <harm> [--root DIR]     print a harm's subtree down to tools
  rbc sensors [--root DIR] [--only a,b]   run the deterministic sensors
  rbc lint                         lint core steering + personas
  rbc leak-test                    scan shipped core for the author's own program
  rbc graph compile --check        compile the stage graph and check it
  rbc check                        composite CI: lint + leak-test + graph + fixtures
  rbc sensors-list                 list sensor names`);
}
