import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

/**
 * Runs the real inline tracker of BaseHead.astro in a vm with a fake browser
 * and checks what the cumulative beacon carries for Web Vitals.
 */
const src = readFileSync(new URL("../components/BaseHead.astro", import.meta.url), "utf8");
const TRACKER = [...src.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('"/api/e"')) as string;

type Handler = (...a: unknown[]) => void;

function browser(opts: { observers?: string[] } = {}) {
  const supported = opts.observers ?? ["largest-contentful-paint", "layout-shift", "event"];
  const observers = new Map<string, (l: { getEntries(): unknown[] }) => void>();
  const listeners = new Map<string, Handler[]>();
  const add = (t: string, h: Handler) => listeners.set(t, [...(listeners.get(t) ?? []), h]);
  const beacons: Array<Record<string, unknown>> = [];
  const requests: unknown[] = [];

  class PO {
    cb: (l: { getEntries(): unknown[] }) => void;
    constructor(cb: PO["cb"]) {
      this.cb = cb;
    }
    observe(o: { type: string }) {
      if (!supported.includes(o.type)) throw new TypeError("unsupported");
      observers.set(o.type, this.cb);
    }
  }
  const doc = {
    referrer: "",
    visibilityState: "visible",
    documentElement: { scrollHeight: 2000 },
    addEventListener: add,
  };
  const ctx: Record<string, unknown> = {
    document: doc,
    location: { pathname: "/blog/x", search: "", hostname: "valerionarcisi.me", hash: "" },
    history: { replaceState() {} },
    navigator: {
      webdriver: false,
      language: "it",
      sendBeacon: (_u: string, body: string) => (beacons.push(JSON.parse(body)), true),
    },
    screen: { width: 1, height: 1 },
    innerWidth: 400,
    innerHeight: 800,
    scrollY: 0,
    crypto: { getRandomValues: (a: Uint8Array) => a },
    fetch: (_u: string, init: { body: string }) => (requests.push(JSON.parse(init.body)), Promise.resolve()),
    setInterval: () => 1,
    clearInterval() {},
    getSelection: () => ({ anchorNode: null }),
    PerformanceObserver: PO,
    addEventListener: add,
    removeEventListener() {},
    Intl,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    Object,
    Array,
    Uint8Array,
    Promise,
  };
  ctx.window = ctx;
  runInNewContext(TRACKER, ctx);

  const emit = (type: string, entries: unknown[]) => observers.get(type)?.({ getEntries: () => entries });
  const hide = () => {
    doc.visibilityState = "hidden";
    (listeners.get("visibilitychange") ?? []).forEach((h) => h());
  };
  const lastBeacon = () => beacons[beacons.length - 1];
  return { emit, hide, lastBeacon, beacons, requests, listeners, observers };
}

const shift = (startTime: number, value: number, hadRecentInput = false) => ({ startTime, value, hadRecentInput });
const ev = (interactionId: number, duration: number) => ({ interactionId, duration });

describe("tracker web vitals", () => {
  test("the tracker script was found", () => {
    expect(TRACKER).toContain("PerformanceObserver");
  });

  test("LCP: the last entry wins, until the first user input", () => {
    const b = browser();
    b.emit("largest-contentful-paint", [{ startTime: 900 }, { startTime: 1800.4 }]);
    b.hide();
    expect(b.lastBeacon().lcp_ms).toBe(1800);
  });

  test("LCP stops updating after the first keydown/pointerdown", () => {
    const b = browser();
    b.emit("largest-contentful-paint", [{ startTime: 1200 }]);
    b.listeners.get("pointerdown")?.forEach((h) => h());
    b.emit("largest-contentful-paint", [{ startTime: 9000 }]);
    b.hide();
    expect(b.lastBeacon().lcp_ms).toBe(1200);
  });

  test("CLS: ignores shifts after input and reports the WORST session window", () => {
    const b = browser();
    b.emit("layout-shift", [
      shift(100, 0.05),
      shift(600, 0.05), // same window (gap < 1 s): 0.10
      shift(700, 0.5, true), // had recent input: ignored
      shift(3000, 0.02), // new window (gap >= 1 s): 0.02
      shift(3500, 0.03), // 0.05
    ]);
    b.hide();
    expect(b.lastBeacon().cls).toBeCloseTo(0.1, 4);
  });

  test("CLS: a window is capped at 5 s even with a steady stream of shifts", () => {
    const b = browser();
    const entries = [];
    for (let t = 0; t <= 6000; t += 500) entries.push(shift(t, 0.01)); // gaps < 1 s all the way
    b.emit("layout-shift", entries);
    b.hide();
    // window 1: t = 0..4500 (10 shifts), window 2 starts at 5000 (3 shifts) -> max is 0.10
    expect(b.lastBeacon().cls).toBeCloseTo(0.1, 4);
  });

  test("INP: p98 of interaction durations (max below 50 interactions), grouped by interactionId", () => {
    const b = browser();
    b.emit("event", [ev(1, 80), ev(1, 150), ev(2, 90), ev(0, 5000), ev(3, 120)]);
    b.hide();
    expect(b.lastBeacon().inp_ms).toBe(150); // interactionId 0 is not an interaction
  });

  test("INP with 100 interactions skips the worst two (p98)", () => {
    const b = browser();
    b.emit("event", Array.from({ length: 100 }, (_, i) => ev(i + 1, 100 + i))); // 100..199
    b.hide();
    expect(b.lastBeacon().inp_ms).toBe(197);
  });

  test("a page with no measurements sends the plain beacon (no vitals keys, no extra requests)", () => {
    const b = browser();
    b.hide();
    const bc = b.lastBeacon();
    expect(bc).toMatchObject({ type: "beacon", time_on_page: expect.any(Number) });
    expect("lcp_ms" in bc || "cls" in bc || "inp_ms" in bc).toBe(false);
    expect(b.beacons).toHaveLength(1);
  });

  test("unsupported entry types are skipped silently (nothing sent for them)", () => {
    const b = browser({ observers: ["largest-contentful-paint"] });
    b.emit("largest-contentful-paint", [{ startTime: 2000 }]);
    b.hide();
    const bc = b.lastBeacon();
    expect(bc.lcp_ms).toBe(2000);
    expect("cls" in bc || "inp_ms" in bc).toBe(false);
  });

  test("no PerformanceObserver at all: the tracker still works", () => {
    const b = browser({ observers: [] });
    b.hide();
    expect(b.lastBeacon().type).toBe("beacon");
  });

  test("values ride in the existing beacon: no extra request types", () => {
    const b = browser();
    b.emit("largest-contentful-paint", [{ startTime: 1000 }]);
    b.hide();
    const types = [...b.requests, ...b.beacons].map((r) => (r as { type: string }).type);
    expect(new Set(types)).toEqual(new Set(["pageview", "beacon"]));
  });
});
