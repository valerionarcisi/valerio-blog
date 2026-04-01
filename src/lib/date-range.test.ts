import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateRange, subtractDays, isoDate } from "./date-range";

describe("isoDate", () => {
  test("formats date as YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05");
  });

  test("uses UTC date, not local", () => {
    expect(isoDate(new Date("2026-03-05T23:30:00Z"))).toBe("2026-03-05");
  });
});

describe("subtractDays", () => {
  test("subtracts 1 day", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    expect(isoDate(subtractDays(d, 1))).toBe("2026-03-04");
  });

  test("subtracts 7 days", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    expect(isoDate(subtractDays(d, 7))).toBe("2026-02-26");
  });

  test("crosses month boundary", () => {
    const d = new Date("2026-03-02T12:00:00Z");
    expect(isoDate(subtractDays(d, 5))).toBe("2026-02-25");
  });

  test("crosses year boundary", () => {
    const d = new Date("2026-01-03T12:00:00Z");
    expect(isoDate(subtractDays(d, 5))).toBe("2025-12-29");
  });

  test("does not mutate original date", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    const original = d.getTime();
    subtractDays(d, 3);
    expect(d.getTime()).toBe(original);
  });

  test("handles DST spring-forward (Mar 29 CET→CEST)", () => {
    const mar30 = new Date("2026-03-30T00:00:00Z");
    expect(isoDate(subtractDays(mar30, 1))).toBe("2026-03-29");
    expect(isoDate(subtractDays(mar30, 2))).toBe("2026-03-28");
  });

  test("handles DST fall-back (Oct 25 CEST→CET)", () => {
    const oct26 = new Date("2026-10-26T00:00:00Z");
    expect(isoDate(subtractDays(oct26, 1))).toBe("2026-10-25");
    expect(isoDate(subtractDays(oct26, 2))).toBe("2026-10-24");
  });

  test("consecutive subtraction covers every day without gaps", () => {
    const start = new Date("2026-04-01T10:00:00Z");
    const dates: string[] = [];
    for (let i = 0; i <= 7; i++) {
      dates.push(isoDate(subtractDays(start, i)));
    }
    expect(dates).toEqual([
      "2026-04-01",
      "2026-03-31",
      "2026-03-30",
      "2026-03-29",
      "2026-03-28",
      "2026-03-27",
      "2026-03-26",
      "2026-03-25",
    ]);
  });

  test("handles leap year Feb 29", () => {
    const mar1 = new Date("2028-03-01T12:00:00Z");
    expect(isoDate(subtractDays(mar1, 1))).toBe("2028-02-29");
  });

  test("handles non-leap year Feb 28", () => {
    const mar1 = new Date("2026-03-01T12:00:00Z");
    expect(isoDate(subtractDays(mar1, 1))).toBe("2026-02-28");
  });
});

describe("getDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("today: from equals to, groupBy hour", () => {
    const r = getDateRange("today");
    expect(r.from).toBe("2026-03-05");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("hour");
  });

  test("7d: 7 days back, groupBy day", () => {
    const r = getDateRange("7d");
    expect(r.from).toBe("2026-02-26");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("day");
  });

  test("30d: 30 days back, groupBy day", () => {
    const r = getDateRange("30d");
    expect(r.from).toBe("2026-02-03");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("day");
  });

  test("90d: 90 days back, groupBy day", () => {
    const r = getDateRange("90d");
    expect(r.from).toBe("2025-12-05");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("day");
  });

  test("12m: 365 days back, groupBy month", () => {
    const r = getDateRange("12m");
    expect(r.from).toBe("2025-03-05");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("month");
  });

  test("custom with from === to: groupBy hour", () => {
    const r = getDateRange("custom", "2026-03-05", "2026-03-05");
    expect(r.from).toBe("2026-03-05");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("hour");
  });

  test("custom with range: groupBy day", () => {
    const r = getDateRange("custom", "2026-03-01", "2026-03-05");
    expect(r.from).toBe("2026-03-01");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("day");
  });

  test("custom without from: defaults to 30d back", () => {
    const r = getDateRange("custom");
    expect(r.from).toBe("2026-02-03");
  });

  test("unknown period: defaults to 30d", () => {
    const r = getDateRange("unknown");
    expect(r.from).toBe("2026-02-03");
    expect(r.to).toBe("2026-03-05");
    expect(r.groupBy).toBe("day");
  });

  test("custom to parameter overrides default", () => {
    const r = getDateRange("custom", "2026-01-01", "2026-02-01");
    expect(r.from).toBe("2026-01-01");
    expect(r.to).toBe("2026-02-01");
    expect(r.groupBy).toBe("day");
  });

  test("today with explicit to: uses provided to", () => {
    const r = getDateRange("today", undefined, "2026-03-01");
    expect(r.from).toBe("2026-03-01");
    expect(r.to).toBe("2026-03-01");
    expect(r.groupBy).toBe("hour");
  });

  test("7d range around DST boundary includes all days", () => {
    vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
    const r = getDateRange("7d");
    expect(r.from).toBe("2026-03-25");
    expect(r.to).toBe("2026-04-01");
  });
});
