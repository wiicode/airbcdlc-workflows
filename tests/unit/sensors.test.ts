// Canary tests: clean fixtures stay clean; the mutant trips every sensor; traces resolve.
import { test, expect } from "bun:test";
import { resolve } from "node:path";
import { build, traceUp } from "../../core/tools/src/lib/tree.ts";
import { runSensors } from "../../core/tools/src/sensors/index.ts";

const fx = (name: string) => resolve(import.meta.dir, "../fixtures", name);
const reds = (name: string) => new Set(runSensors(build(fx(name))).filter((h) => h.severity === "red").map((h) => h.sensor));
const all = (name: string) => new Set(runSensors(build(fx(name))).map((h) => h.sensor));

test("example-a: the clean worked example has no red sensors", () => {
  expect([...reds("example-a")]).toEqual([]);
});

test("example-a: remote-support-tool backs out to H1", () => {
  expect(traceUp(build(fx("example-a")), "remote-support-tool").harm).toBe("H1");
});

test("example-b: developer-token example has no red sensors", () => {
  expect([...reds("example-b")]).toEqual([]);
});

test("byod-monitor: the remote-operative branch crosses to H2", () => {
  expect(traceUp(build(fx("byod-monitor")), "R-031d").harm).toBe("H2");
});

test("byod-monitor: a BYOD data branch stays at H1", () => {
  expect(traceUp(build(fx("byod-monitor")), "R-031a").harm).toBe("H1");
});

test("byod-monitor: no red sensors — the monitor is placed, not substituted", () => {
  expect([...reds("byod-monitor")]).toEqual([]);
});

test("_mutants: every guarded sensor fires", () => {
  const fired = all("_mutants");
  for (const s of [
    "harm-sentence",
    "control-link",
    "owner-outside-security",
    "decision-complete",
    "orphan-node",
    "premise-moved",
  ]) {
    expect(fired.has(s)).toBe(true);
  }
});

test("_mutants: a missing control premise re-opens the decision", () => {
  const hits = runSensors(build(fx("_mutants")), ["premise-moved"]);
  expect(hits.some((h) => h.detail.includes("MX1") && h.detail.includes("missing"))).toBe(true);
});
