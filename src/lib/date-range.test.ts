import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateRange } from "./date-range";

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
});
