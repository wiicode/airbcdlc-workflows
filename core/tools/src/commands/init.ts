// rbc init — scaffold a program repo. The data IS the source code; this lays the empty frame plus the default roots.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIRS = [
  "steering", "steering/rules", "steering/overrides",
  "harms", "tolerances", "risks", "decisions", "obligations",
  "controls/library", "controls/implementation",
  "findings", "scenarios", "monitoring", "reviews", "crosswalks",
  "policies", "evidence", "tasks", "knowledge",
  "inventory/systems", "inventory/people", "inventory/devices",
  "inventory/vendors", "inventory/access", "inventory/data-stores",
  "mirrors", "rbc/programkb", "rbc/intents", "rbc/views",
  ".claude/rules",
];

// Default roots (plan §5.1). Starter set until the author supplies his own (D11). Marked [DRAFT].
const HARMS: Array<[string, string, string, string]> = [
  ["H1", "Business damage from a security incident", "The company suffers reputational, legal, or financial damage because a security incident reaches customers, data, or operations.", "T-01"],
  ["H2", "Regulatory and legal exposure", "The company faces regulatory action, legal liability, or loss of authorization because an obligation it is subject to is not met.", "T-02"],
  ["H3", "Loss of customer trust and revenue", "The company loses customers, deals, or renewals because trust in its security or handling of data is broken.", "T-03"],
  ["H4", "Operational disruption", "The company cannot operate or deliver because a system, service, or dependency it relies on is unavailable or degraded.", "T-04"],
  ["H5", "Financial loss and fraud", "The company loses money directly because a financial flow is manipulated, diverted, or defrauded.", "T-05"],
  ["H6", "Unlawful handling of personal data", "The company processes personal data unlawfully because a legal basis, limit, or right is not honored.", "T-06"],
];

const TOLERANCES: Array<[string, string, string]> = [
  ["T-01", "H1", "The company will not carry a security exposure that could cause customer-reaching damage beyond [threshold — set by leadership]."],
  ["T-02", "H2", "The company will not carry an unmet obligation beyond [threshold — set by leadership]."],
  ["T-03", "H3", "The company will not carry a trust exposure that could cost customers beyond [threshold — set by leadership]."],
  ["T-04", "H4", "The company will carry availability risk only up to a recovery time of [threshold — set by leadership]."],
  ["T-05", "H5", "The company will not carry fraud or financial-flow exposure beyond [threshold — set by leadership]."],
  ["T-06", "H6", "The company will not carry unlawful personal-data processing — zero tolerance, [scope — set by leadership]."],
];

function today() { return new Date().toISOString().slice(0, 10); }

function harmFile(id: string, title: string, statement: string, tol: string) {
  return `---
id: ${id}
title: ${title}
statement: >-
  ${statement}
owner: "[DRAFT — name the executive seat that owns this harm]"
tolerances: [${tol}]
provenance:
  source: "rbc init (default root set — D11 open)"
  added: ${today()}
  updated: ${today()}
---

# ${id} — ${title}

> **[DRAFT]** A default root from the field guide's harm set. Replace with your own words and owner
> through the \`risk-appetite\` stage. Roots rarely change; get them right once.
`;
}

function tolFile(id: string, harm: string, statement: string) {
  return `---
id: ${id}
harm: ${harm}
statement: >-
  ${statement}
owner: "[DRAFT — the executive who writes and signs this]"
review_cadence: quarterly
provenance:
  source: "rbc init (draft tolerance)"
  added: ${today()}
  updated: ${today()}
---

# ${id} — tolerance for ${harm}

> **[DRAFT]** Five to seven of these, written by leadership. One sentence a non-technical
> executive can read and sign. Every risk's residual compares to one.
`;
}

const CONFIG = `# rbc.config.yaml — how this program is wired to the harness.
harness_version: "0.1.0-m0"
framework_profile: nist-csf-2   # generic in core; swap per program
sources: inventory/sources.yaml
plugins: []
publish_targets: []             # compliance platform / trust center — added later, each a recorded decision
`;

const RULES = `# Ambient program rules — loaded into every stage.
# Framework steering (how the method thinks) is @-imported from the harness; program steering (how WE decided) from this repo.

@${"{HARNESS}"}/core/steering/method/field-guide.md
@${"{HARNESS}"}/core/steering/house-rules/voice.md
@${"{HARNESS}"}/core/steering/risk-core/placement-rules.md

# Program position papers (written through stages):
@steering/company.md
@steering/appetite.md
@steering/roles.md

# The quality bar: apply, don't recite. Nothing agent-authored reaches a record ungated.
`;

const SOURCES = `# Sources registry — no source, no fact.
sources:
  - slug: manual-entry
    kind: file
    license_class: public-domain
    reads: [any]
    note: "Hand-authored records during bootstrap. Replace with real feeds in sources-discovery."
`;

export function init(root = process.cwd()): string[] {
  const made: string[] = [];
  for (const d of DIRS) {
    const abs = join(root, d);
    if (!existsSync(abs)) { mkdirSync(abs, { recursive: true }); made.push(d + "/"); }
  }
  const write = (rel: string, content: string) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) { writeFileSync(abs, content); made.push(rel); }
  };
  for (const [id, title, stmt, tol] of HARMS) write(`harms/${id}.md`, harmFile(id, title, stmt, tol));
  for (const [id, harm, stmt] of TOLERANCES) write(`tolerances/${id}.md`, tolFile(id, harm, stmt));
  write("rbc.config.yaml", CONFIG);
  write("inventory/sources.yaml", SOURCES);
  write(".claude/rules/rbc.md", RULES);
  write("steering/company.md", "# Company — who we are, what we do, what we care about.\n\n> Written through the `intent-capture` and `risk-appetite` stages.\n");
  write("steering/appetite.md", "# Appetite — the exposures leadership will and will not carry.\n\n> The tolerances in `tolerances/` are the signable sentences; this is the narrative behind them.\n");
  write("steering/roles.md", "# Roles — who owns decisions, assessment, and the record; declared capacity and cadence.\n");
  return made;
}
