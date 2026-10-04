// Program-repo layout. One home for the directory → record-type map (drift canary lives here).
import { resolve } from "node:path";

export const HARNESS_ROOT = resolve(import.meta.dir, "../../../..");
export const SCHEMA_DIR = resolve(HARNESS_ROOT, "core/schemas");

// Directory (relative to a program repo root) → schema $id slug.
// A record's type is where it lives. risks/ holds both parents and branches, split by id shape.
export const RECORD_DIRS: Record<string, string> = {
  "harms": "harm",
  "tolerances": "tolerance",
  "risks": "risk", // resolved to risk-parent | risk-branch by id
  "decisions": "decision",
  "obligations": "obligation",
  "findings": "finding",
  "scenarios": "scenario",
  "monitoring": "monitoring-proposal",
  "reviews": "review-record",
  "crosswalks": "crosswalk-row",
  "controls/library": "control-library",
  "controls/implementation": "control-implementation",
  "inventory/systems": "inventory-system",
  "inventory/people": "inventory-person",
  "inventory/devices": "inventory-device",
  "inventory/vendors": "inventory-vendor",
  "inventory/access": "inventory-access",
};

export const BRANCH_ID = /^R-\d{3}[a-z]$/;
export const PARENT_ID = /^R-\d{3}$/;

export function programRoot(cwd = process.cwd()): string {
  return resolve(cwd);
}
