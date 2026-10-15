import { describe, test, expect } from "vitest";
import { EVENT_NAMES, parseEvent, validateEvent } from "./analytics-events";
import { GOALS } from "./analytics-goals";
import {
  engagedDelta,
  isBounce,
  sessionCutoff,
  sqlTime,
} from "./analytics-sessions";

describe("validateEvent", () => {
  test("whitelist: every name is accepted, unknown ones rejected", () => {
    for (const n of EVENT_NAMES) {
      const prop =
        n === "outbound_click"
          ? "a.com"
          : n === "download"
            ? "pdf"
            : n === "share"
              ? "x"
              : undefined;
      expect(validateEvent(n, prop).ok, n).toBe(true);
    }
    expect(validateEvent("pageview", null).ok).toBe(false);
    expect(validateEvent(42, null).ok).toBe(false);
    expect(validateEvent("__proto__", null).ok).toBe(false);
  });

  test("props are normalised and length capped", () => {
    expect(validateEvent("outbound_click", " GitHub.com ")).toMatchObject({ prop: "github.com" });
    expect(validateEvent("outbound_click", "a.b".padEnd(101, "c")).ok).toBe(false);
    expect(validateEvent("outbound_click", "evil.com/path").ok).toBe(false);
    expect(validateEvent("download", "exe").ok).toBe(false);
    expect(validateEvent("download", ".Epub")).toMatchObject({ prop: "epub" });
    expect(validateEvent("share", "myspace").ok).toBe(false);
    expect(validateEvent("clap", "free text")).toMatchObject({ ok: true, prop: null });
    expect(validateEvent("not_found", "")).toMatchObject({ ok: true, prop: null });
  });

  test("parseEvent checks host and page_id", () => {
    const ok = { hostname: "valerionarcisi.me", page_id: "a".repeat(16), name: "clap" };
    expect(parseEvent(ok).ok).toBe(true);
    expect(parseEvent({ ...ok, hostname: "evil.com" }).ok).toBe(false);
    expect(parseEvent({ ...ok, page_id: "x" }).ok).toBe(false);
  });

  test("every goal points at a whitelisted event", () => {
    for (const g of GOALS) expect(EVENT_NAMES).toContain(g.event);
  });
});

describe("session helpers", () => {
  test("engagedDelta is never negative", () => {
    expect(engagedDelta(null, 12)).toBe(12);
    expect(engagedDelta(10, 25)).toBe(15);
    expect(engagedDelta(25, 10)).toBe(0);
    expect(engagedDelta(undefined, undefined)).toBe(0);
  });

  test("bounce = exactly 1 pageview and < 10 s engaged", () => {
    expect(isBounce(1, 0)).toBe(true);
    expect(isBounce(1, 9)).toBe(true);
    expect(isBounce(1, 10)).toBe(false);
    expect(isBounce(2, 0)).toBe(false);
  });

  test("cutoff is 30 minutes back, SQLite format", () => {
    const now = new Date("2026-03-05T10:00:00Z");
    expect(sqlTime(now)).toBe("2026-03-05 10:00:00");
    expect(sessionCutoff(now)).toBe("2026-03-05 09:30:00");
  });
});
