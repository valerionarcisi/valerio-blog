/**
 * Core Web Vitals (RUM). Pure helpers, no imports from the rollup/stats modules
 * (they import this one). Storage units: lcp_ms, inp_ms in milliseconds,
 * cls_milli = CLS * 1000 (integer). Rollup p75 uses the same units.
 */
export type Metric = "lcp" | "inp" | "cls";
export const METRICS: Metric[] = ["lcp", "inp", "cls"];
export type Rating = "good" | "ni" | "poor";

/** Google thresholds in storage units: good <= first, poor > second. */
export const THRESHOLDS: Record<Metric, [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [100, 250],
};

export const LCP_MAX_MS = 60_000;
export const INP_MAX_MS = 10_000;
export const CLS_MAX = 10;

export interface VitalsInput {
  lcpMs: number | null;
  clsMilli: number | null;
  inpMs: number | null;
}

function finite(v: unknown): number | null {
  if (v == null || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Out-of-range or non-numeric values are dropped (never stored), the beacon itself stays valid. */
export function parseVitals(body: Record<string, unknown>): VitalsInput {
  const lcp = finite(body.lcp_ms);
  const inp = finite(body.inp_ms);
  const cls = finite(body.cls);
  return {
    lcpMs: lcp != null && lcp >= 0 && lcp <= LCP_MAX_MS ? Math.round(lcp) : null,
    inpMs: inp != null && inp >= 0 && inp <= INP_MAX_MS ? Math.round(inp) : null,
    clsMilli: cls != null && cls >= 0 && cls <= CLS_MAX ? Math.round(cls * 1000) : null,
  };
}

export function hasVitals(v: VitalsInput): boolean {
  return v.lcpMs != null || v.clsMilli != null || v.inpMs != null;
}

export function rate(metric: Metric, value: number): Rating {
  const [good, poor] = THRESHOLDS[metric];
  return value <= good ? "good" : value > poor ? "poor" : "ni";
}

/** Nearest-rank p75 of an ASCENDING sorted array: element ceil(0.75 n) - 1. */
export function p75Sorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.ceil(sorted.length * 0.75) - 1];
}

export interface VitalsRow {
  device: string;
  metric: Metric;
  n: number;
  good: number;
  ni: number;
  poor: number;
  p75: number;
}

export interface RawVital {
  device: string | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
}

export const ALL_DEVICES = "all";

/**
 * Buckets + exact p75 for one group of raw rows. Emits a device = 'all' row per
 * metric plus one per device_type (NULL -> 'unknown'). Metrics with n = 0 emit nothing.
 */
export function buildVitalsRows(rows: RawVital[]): VitalsRow[] {
  const groups = new Map<string, Record<Metric, number[]>>();
  const push = (device: string, r: RawVital) => {
    const g = groups.get(device) ?? { lcp: [], inp: [], cls: [] };
    for (const m of METRICS) {
      const v = r[m];
      if (v != null) g[m].push(v);
    }
    groups.set(device, g);
  };
  for (const r of rows) {
    push(ALL_DEVICES, r);
    push(r.device || "unknown", r);
  }
  const out: VitalsRow[] = [];
  for (const [device, g] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const m of METRICS) {
      const vals = g[m].sort((a, b) => a - b);
      if (vals.length === 0) continue;
      let good = 0;
      let ni = 0;
      let poor = 0;
      for (const v of vals) {
        const r = rate(m, v);
        if (r === "good") good++;
        else if (r === "ni") ni++;
        else poor++;
      }
      out.push({ device, metric: m, n: vals.length, good, ni, poor, p75: p75Sorted(vals) as number });
    }
  }
  return out;
}

export interface VitalSummary {
  p75: number | null;
  good: number;
  ni: number;
  poor: number;
  n: number;
}

export const emptySummary = (): VitalSummary => ({ p75: null, good: 0, ni: 0, poor: 0, n: 0 });

/** Storage units -> API units (cls_milli -> CLS with 3 decimals). */
export function toApiP75(metric: Metric, p75: number | null): number | null {
  if (p75 == null) return null;
  return metric === "cls" ? Math.round(p75) / 1000 : Math.round(p75);
}

/**
 * Combines parts of a range. Counts add up EXACTLY. p75 is exact when there is
 * a single part; across several parts (days read from daily_vitals, plus a raw
 * group) it is the n-weighted average of the parts' p75: an APPROXIMATION.
 */
export function combineParts(
  parts: Array<{ n: number; good: number; ni: number; poor: number; p75: number }>,
): { n: number; good: number; ni: number; poor: number; p75: number | null } {
  const t = { n: 0, good: 0, ni: 0, poor: 0, w: 0 };
  for (const p of parts) {
    t.n += p.n;
    t.good += p.good;
    t.ni += p.ni;
    t.poor += p.poor;
    t.w += p.p75 * p.n;
  }
  return { n: t.n, good: t.good, ni: t.ni, poor: t.poor, p75: t.n > 0 ? Math.round(t.w / t.n) : null };
}
