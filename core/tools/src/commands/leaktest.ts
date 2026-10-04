// Leak test + licensed-text guard. Core ships the method, never the author's own program.
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { HARNESS_ROOT } from "../lib/paths.ts";
import type { Hit } from "../sensors/index.ts";

function glob(root: string, pattern: string): string[] {
  // minimal **/*.ext glob
  const [prefix, ext] = pattern.split("**/");
  const base = join(root, prefix.replace(/\/$/, ""));
  const wantExt = ext.replace(/^\*/, "");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (p.endsWith(wantExt)) out.push(p);
    }
  };
  walk(base);
  return out;
}

export function leaktest(root = HARNESS_ROOT): { hits: Hit[]; scanned: number } {
  const cfg = JSON.parse(readFileSync(join(root, "tests/canaries/forbidden.json"), "utf8"));
  const files = new Set<string>();
  for (const g of cfg.scan_globs) for (const f of glob(root, g)) files.add(f);
  const patterns = cfg.forbidden.map((p: any) => ({ name: p.name, re: new RegExp(p.pattern, "gi") }));
  const allow: string[] = cfg.allow ?? [];
  const hits: Hit[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file);
    const lines = text.split("\n");
    for (const { name, re } of patterns) {
      lines.forEach((line, i) => {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          const hitStr = m[0];
          // skip if the match sits inside an allowlisted phrase on this line
          if (allow.some((a) => line.includes(a))) continue;
          hits.push({ sensor: `leak:${name}`, severity: "red", file: `${rel}:${i + 1}`,
            detail: `forbidden token "${hitStr}" in shipped core — the method must survive replacing the company's name.` });
        }
      });
    }
  }

  // licensed-text guard: physical-path check
  const guard = cfg.licensed_text_guard?.forbidden_committed_dirs ?? [];
  for (const d of guard) {
    const abs = join(root, d);
    if (existsSync(abs)) {
      const n = (() => { try { return readdirSync(abs).length; } catch { return 0; } })();
      if (n > 0) hits.push({ sensor: "leak:licensed-text", severity: "red", file: d,
        detail: `${n} file(s) committed under ${d} — licensed texts are indexed locally and never committed.` });
    }
  }

  return { hits, scanned: files.size };
}
