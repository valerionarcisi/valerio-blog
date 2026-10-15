import { describe, test, expect } from "vitest";
import {
  buildVitalsRows,
  combineParts,
  p75Sorted,
  parseVitals,
  rate,
  toApiP75,
} from "./analytics-vitals";

describe("parseVitals", () => {
  test("accepts in-range values and converts CLS to thousandths", () => {
    expect(parseVitals({ lcp_ms: 1234.6, inp_ms: 180, cls: 0.0834 })).toEqual({
      lcpMs: 1235,
      inpMs: 180,
      clsMilli: 83,
    });
  });
  test("boundaries are inclusive", () => {
    expect(parseVitals({ lcp_ms: 0, inp_ms: 10000, cls: 10 })).toEqual({
      lcpMs: 0,
      inpMs: 10000,
      clsMilli: 10000,
    });
    expect(parseVitals({ lcp_ms: 60000 }).lcpMs).toBe(60000);
  });
  test("out of range, negative, non numeric and booleans are dropped", () => {
    expect(parseVitals({ lcp_ms: 60001, inp_ms: 10001, cls: 10.01 })).toEqual({
      lcpMs: null,
      inpMs: null,
      clsMilli: null,
    });
    expect(parseVitals({ lcp_ms: -1, inp_ms: "abc", cls: true })).toEqual({
      lcpMs: null,
      inpMs: null,
      clsMilli: null,
    });
    expect(parseVitals({ lcp_ms: NaN, cls: Infinity }).lcpMs).toBeNull();
    expect(parseVitals({})).toEqual({ lcpMs: null, inpMs: null, clsMilli: null });
  });
});

describe("rate (Google thresholds)", () => {
  test.each([
    ["lcp", 2500, "good"],
    ["lcp", 2501, "ni"],
    ["lcp", 4000, "ni"],
    ["lcp", 4001, "poor"],
    ["inp", 200, "good"],
    ["inp", 201, "ni"],
    ["inp", 500, "ni"],
    ["inp", 501, "poor"],
    ["cls", 100, "good"],
    ["cls", 101, "ni"],
    ["cls", 250, "ni"],
    ["cls", 251, "poor"],
  ] as const)("%s %i -> %s", (m, v, r) => expect(rate(m, v)).toBe(r));
});

describe("p75 / rows", () => {
  test("nearest-rank p75", () => {
    expect(p75Sorted([])).toBeNull();
    expect(p75Sorted([5])).toBe(5);
    expect(p75Sorted([1, 2, 3, 4])).toBe(3);
    expect(p75Sorted([1, 2, 3, 4, 5, 6, 7, 8])).toBe(6);
  });
  test("buildVitalsRows emits 'all' plus per device, skipping metrics without data", () => {
    const rows = buildVitalsRows([
      { device: "mobile", lcp: 2000, inp: null, cls: 50 },
      { device: "mobile", lcp: 5000, inp: null, cls: 300 },
      { device: "desktop", lcp: 1000, inp: 100, cls: null },
      { device: null, lcp: 3000, inp: null, cls: null },
    ]);
    const get = (d: string, m: string) => rows.find((r) => r.device === d && r.metric === m);
    expect(get("all", "lcp")).toMatchObject({ n: 4, good: 2, ni: 1, poor: 1, p75: 3000 });
    expect(get("mobile", "lcp")).toMatchObject({ n: 2, good: 1, poor: 1 });
    expect(get("unknown", "lcp")).toMatchObject({ n: 1, ni: 1 });
    expect(get("desktop", "inp")).toMatchObject({ n: 1, good: 1, p75: 100 });
    expect(get("mobile", "inp")).toBeUndefined();
    expect(get("all", "cls")).toMatchObject({ n: 2, good: 1, poor: 1 });
  });
  test("combineParts: counts exact, p75 n-weighted average", () => {
    const c = combineParts([
      { n: 10, good: 5, ni: 3, poor: 2, p75: 2000 },
      { n: 30, good: 20, ni: 5, poor: 5, p75: 3000 },
    ]);
    expect(c).toEqual({ n: 40, good: 25, ni: 8, poor: 7, p75: 2750 });
    expect(combineParts([])).toMatchObject({ n: 0, p75: null });
  });
  test("toApiP75 converts CLS back to units", () => {
    expect(toApiP75("cls", 83)).toBe(0.083);
    expect(toApiP75("lcp", 2000.4)).toBe(2000);
    expect(toApiP75("lcp", null)).toBeNull();
  });
});
