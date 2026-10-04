// ajv-backed validator. Loads every schema under core/schemas by $id; refs resolve against those ids.
import Ajv, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_DIR } from "./paths.ts";

let ajv: Ajv | null = null;
const validators = new Map<string, ValidateFunction>();

function slugToId(slug: string): string {
  return `https://airbcdlc.dev/schema/${slug}`;
}

export function getAjv(): Ajv {
  if (ajv) return ajv;
  ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(ajv);
  for (const f of readdirSync(SCHEMA_DIR)) {
    if (!f.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8"));
    ajv.addSchema(schema);
  }
  return ajv;
}

export function validatorFor(type: string): ValidateFunction | null {
  if (validators.has(type)) return validators.get(type)!;
  const a = getAjv();
  const v = a.getSchema(slugToId(type));
  if (!v) return null;
  validators.set(type, v as ValidateFunction);
  return v as ValidateFunction;
}

export interface SchemaError {
  path: string;
  message: string;
}

export function validateRecord(type: string, data: any): SchemaError[] {
  const v = validatorFor(type);
  if (!v) return [{ path: "", message: `no schema for type '${type}'` }];
  const ok = v(data);
  if (ok) return [];
  return (v.errors ?? []).map((e) => ({
    path: e.instancePath || "(root)",
    message: `${e.message}${e.params && Object.keys(e.params).length ? " " + JSON.stringify(e.params) : ""}`,
  }));
}
