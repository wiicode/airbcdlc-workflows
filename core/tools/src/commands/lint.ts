// Steering + persona lint. Light by design: the quality bar is the steering itself; lint checks shape.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { HARNESS_ROOT } from "../lib/paths.ts";
import type { Hit } from "../sensors/index.ts";

function mdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".md")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const FULL_SECTIONS = [
  "Role Identity", "Core Expertise", "Key Responsibilities", "Decision-Making Authority",
  "Collaboration Style", "Inter-Expert Collaboration", "Tier-Specific Behavior", "Quality Standards",
  "Communication Patterns", "Red Flags You Watch For", "Limitations & Blind Spots",
  "Key Questions You Ask", "Common Patterns You Recommend", "When NOT to Engage",
  "Engagement Triggers", "Success Indicators",
];

// A steering file that opens with a YAML frontmatter block carrying `category:` declares its scope there
// (the sources library ships frontmatter, often longer than 400 chars, which must not be prefixed).
function frontmatterScope(text: string): boolean {
  if (!/^---\r?\n/.test(text)) return false;
  const end = text.indexOf("\n---", 3);            // closing fence; `category:` must sit before it
  return end !== -1 && /^category:\s*\S/m.test(text.slice(0, end));
}

export function lint(root = HARNESS_ROOT): Hit[] {
  const hits: Hit[] = [];

  // 1. steering files carry a scope header
  for (const f of mdFiles(join(root, "core/steering"))) {
    if (basename(f) === "README.md") continue;
    const text = readFileSync(f, "utf8");
    if (!frontmatterScope(text) && !/^<!--\s*scope:/m.test(text.slice(0, 400))) {
      hits.push({ sensor: "lint:scope-header", severity: "amber", file: relative(root, f),
        detail: "steering file has no <!-- scope: ... --> header (or YAML frontmatter with category:)." });
    }
  }

  // 2. preamble exists
  if (!existsSync(join(root, "core/agents/_preamble.md"))) {
    hits.push({ sensor: "lint:preamble", severity: "red", file: "core/agents/_preamble.md",
      detail: "shared persona preamble is missing — full profiles load it before every invocation." });
  }

  // 3. full personas carry the 16 sections; compacts carry a HANDBACK
  for (const f of mdFiles(join(root, "core/agents"))) {
    const b = basename(f);
    if (b === "_preamble.md" || b === "FORMAT.md" || b === "README.md" || b === "index.md") continue;
    const text = readFileSync(f, "utf8");
    if (f.includes("/compact/") || b.endsWith("-compact.md")) {
      if (!/HANDBACK/.test(text)) hits.push({ sensor: "lint:persona-compact", severity: "red",
        file: relative(root, f), detail: "compact persona has no HANDBACK format." });
    } else {
      const missing = FULL_SECTIONS.filter((s) => !text.includes(s));
      if (missing.length) hits.push({ sensor: "lint:persona-full", severity: "amber",
        file: relative(root, f), detail: `full persona missing sections: ${missing.join(", ")}` });
      if (!/STRONGEST OBJECTION/.test(text) || !/FALSIFIER/.test(text))
        hits.push({ sensor: "lint:persona-handback", severity: "red", file: relative(root, f),
          detail: "full persona HANDBACK must carry STRONGEST OBJECTION and FALSIFIER." });
    }
  }

  return hits;
}
