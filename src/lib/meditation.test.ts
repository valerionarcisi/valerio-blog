import { describe, test, expect } from "vitest";
import {
  parseDuration,
  buildGuidedSchedule,
  generateWavDataUri,
  getMonthsOfPractice,
  getCurrentPhase,
  getSuggestedSessionIndex,
  isValidDate,
  isFinitePositive,
  clampInt,
  parseSessionInput,
  parseDeleteId,
  ok,
  err,
} from "./meditation";
import type { Step, Phase } from "./meditation";

// ═══════════════════════════════════════════════════════════════
// parseDuration
// ═══════════════════════════════════════════════════════════════
describe("parseDuration", () => {
  test("parses minutes to seconds", () => {
    expect(parseDuration("3 min")).toBe(180);
    expect(parseDuration("1 min")).toBe(60);
    expect(parseDuration("10 min")).toBe(600);
  });

  test("returns 0 for non-numeric strings", () => {
    expect(parseDuration("continuo")).toBe(0);
    expect(parseDuration("")).toBe(0);
  });

  test("extracts first number from mixed strings", () => {
    expect(parseDuration("about 5 minutes")).toBe(300);
    expect(parseDuration("2-3 min")).toBe(120);
  });

  test("handles null/undefined-like edge cases", () => {
    expect(parseDuration("")).toBe(0);
    // @ts-expect-error testing runtime safety
    expect(parseDuration(null)).toBe(0);
    // @ts-expect-error testing runtime safety
    expect(parseDuration(undefined)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// isValidDate
// ═══════════════════════════════════════════════════════════════
describe("isValidDate", () => {
  test("accepts valid YYYY-MM-DD", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
    expect(isValidDate("2026-12-31")).toBe(true);
  });

  test("rejects invalid formats", () => {
    expect(isValidDate("15-01-2024")).toBe(false);
    expect(isValidDate("2024/01/15")).toBe(false);
    expect(isValidDate("2024-1-5")).toBe(false);
    expect(isValidDate("not-a-date")).toBe(false);
  });

  test("rejects non-string types", () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate(42)).toBe(false);
    expect(isValidDate({})).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isValidDate("")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// isFinitePositive
// ═══════════════════════════════════════════════════════════════
describe("isFinitePositive", () => {
  test("accepts positive finite numbers", () => {
    expect(isFinitePositive(1)).toBe(true);
    expect(isFinitePositive(0.5)).toBe(true);
    expect(isFinitePositive(100)).toBe(true);
  });

  test("rejects zero, negative, NaN, Infinity", () => {
    expect(isFinitePositive(0)).toBe(false);
    expect(isFinitePositive(-1)).toBe(false);
    expect(isFinitePositive(NaN)).toBe(false);
    expect(isFinitePositive(Infinity)).toBe(false);
    expect(isFinitePositive(-Infinity)).toBe(false);
  });

  test("rejects non-numbers", () => {
    expect(isFinitePositive("5")).toBe(false);
    expect(isFinitePositive(null)).toBe(false);
    expect(isFinitePositive(undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// clampInt
// ═══════════════════════════════════════════════════════════════
describe("clampInt", () => {
  test("clamps within range", () => {
    expect(clampInt(5, 0, 10, 0)).toBe(5);
    expect(clampInt(15, 0, 10, 0)).toBe(10);
    expect(clampInt(-5, 0, 10, 0)).toBe(0);
  });

  test("rounds to integer", () => {
    expect(clampInt(5.7, 0, 10, 0)).toBe(6);
    expect(clampInt(5.2, 0, 10, 0)).toBe(5);
  });

  test("returns fallback for non-finite input", () => {
    expect(clampInt(NaN, 0, 10, 7)).toBe(7);
    expect(clampInt(Infinity, 0, 10, 7)).toBe(7);
    expect(clampInt("not a number", 0, 10, 7)).toBe(7);
    expect(clampInt(undefined, 0, 10, 7)).toBe(7);
    expect(clampInt(null, 0, 10, 7)).toBe(7);
  });

  test("coerces string numbers", () => {
    expect(clampInt("5", 0, 10, 0)).toBe(5);
    expect(clampInt("99", 0, 10, 0)).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildGuidedSchedule
// ═══════════════════════════════════════════════════════════════
describe("buildGuidedSchedule", () => {
  const steps: Step[] = [
    { t: "Postura", d: "Desc 1", dur: "1 min" },
    { t: "Respiro", d: "Desc 2", dur: "3 min" },
    { t: "Focus", d: "Desc 3", dur: "4 min" },
    { t: "Ritorno", d: "Desc 4", dur: "continuo" },
  ];

  test("produces correct number of entries", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    expect(schedule).toHaveLength(4);
  });

  test("first step starts at 0", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    expect(schedule[0].at).toBe(0);
  });

  test("steps are sequential (no overlap)", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].at).toBeGreaterThanOrEqual(
        schedule[i - 1].at + schedule[i - 1].duration,
      );
    }
  });

  test("all steps have positive duration", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    schedule.forEach((s) => {
      expect(s.duration).toBeGreaterThan(0);
    });
  });

  test("zero-duration mid-step gets fallback duration", () => {
    const stepsWithZero: Step[] = [
      { t: "A", d: "", dur: "2 min" },
      { t: "B", d: "", dur: "continuo" },
      { t: "C", d: "", dur: "3 min" },
    ];
    const schedule = buildGuidedSchedule(stepsWithZero, 300);
    expect(schedule[1].duration).toBeGreaterThan(0);
  });

  test("preserves step titles and descriptions", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    expect(schedule[0].title).toBe("Postura");
    expect(schedule[1].desc).toBe("Desc 2");
    expect(schedule[2].idx).toBe(2);
  });

  test("returns empty for empty steps", () => {
    expect(buildGuidedSchedule([], 600)).toEqual([]);
  });

  test("returns empty for zero totalSec", () => {
    expect(buildGuidedSchedule(steps, 0)).toEqual([]);
  });

  test("returns empty for negative totalSec", () => {
    expect(buildGuidedSchedule(steps, -100)).toEqual([]);
  });

  test("handles single step", () => {
    const single: Step[] = [{ t: "Solo", d: "Unico step", dur: "5 min" }];
    const schedule = buildGuidedSchedule(single, 300);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].at).toBe(0);
    expect(schedule[0].duration).toBe(300);
  });

  test("handles all-continuo steps (all zero declared)", () => {
    const allZero: Step[] = [
      { t: "A", d: "", dur: "continuo" },
      { t: "B", d: "", dur: "continuo" },
    ];
    const schedule = buildGuidedSchedule(allZero, 600);
    expect(schedule).toHaveLength(2);
    schedule.forEach((s) => {
      expect(s.duration).toBeGreaterThan(0);
    });
  });

  test("very short timer (5 seconds) still produces valid schedule", () => {
    const schedule = buildGuidedSchedule(steps, 5);
    expect(schedule.length).toBe(4);
    expect(schedule[0].at).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// generateWavDataUri
// ═══════════════════════════════════════════════════════════════
describe("generateWavDataUri", () => {
  test("returns a valid data URI", () => {
    const uri = generateWavDataUri(440, 0.1, 0.5, 0.01);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
  });

  test("base64 content is decodable", () => {
    const uri = generateWavDataUri(440, 0.1, 0.5, 0.01);
    const base64 = uri.replace("data:audio/wav;base64,", "");
    const decoded = atob(base64);
    expect(decoded.length).toBeGreaterThan(44);
    expect(decoded.substring(0, 4)).toBe("RIFF");
    expect(decoded.substring(8, 12)).toBe("WAVE");
  });

  test("different frequencies produce different output", () => {
    const a = generateWavDataUri(440, 0.1, 0.5, 0.01);
    const b = generateWavDataUri(880, 0.1, 0.5, 0.01);
    expect(a).not.toBe(b);
  });

  test("returns silent WAV for zero duration", () => {
    const uri = generateWavDataUri(440, 0, 0.5, 0);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
  });

  test("returns silent WAV for zero frequency", () => {
    const uri = generateWavDataUri(0, 0.1, 0.5, 0);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
  });

  test("returns silent WAV for zero volume", () => {
    const uri = generateWavDataUri(440, 0.1, 0, 0);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
  });

  test("returns silent WAV for negative duration", () => {
    const uri = generateWavDataUri(440, -1, 0.5, 0);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
  });

  test("handles decayAt equal to duration (no decay region)", () => {
    const uri = generateWavDataUri(440, 0.5, 0.5, 0.5);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
    const decoded = atob(uri.replace("data:audio/wav;base64,", ""));
    expect(decoded.substring(0, 4)).toBe("RIFF");
  });
});

// ═══════════════════════════════════════════════════════════════
// getMonthsOfPractice
// ═══════════════════════════════════════════════════════════════
describe("getMonthsOfPractice", () => {
  test("returns 0 for empty dates", () => {
    expect(getMonthsOfPractice([])).toBe(0);
  });

  test("returns 0 for recent start", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(getMonthsOfPractice([today])).toBe(0);
  });

  test("never returns negative", () => {
    expect(getMonthsOfPractice(["2099-01-01"])).toBeGreaterThanOrEqual(0);
  });

  test("handles duplicate dates", () => {
    const dates = ["2024-01-01", "2024-01-01", "2024-01-01"];
    const result = getMonthsOfPractice(dates);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test("handles unsorted dates", () => {
    const dates = ["2024-03-01", "2024-01-01", "2024-02-01"];
    const result = getMonthsOfPractice(dates);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// getCurrentPhase
// ═══════════════════════════════════════════════════════════════
describe("getCurrentPhase", () => {
  const phases: Phase[] = [
    { name: "A", months: [0, 1], weights: {} },
    { name: "B", months: [2, 3], weights: {} },
    { name: "C", months: [4], weights: {} },
  ];

  test("returns phase 0 for month 0", () => {
    expect(getCurrentPhase(0, phases)).toBe(0);
  });

  test("returns phase 1 for month 2", () => {
    expect(getCurrentPhase(2, phases)).toBe(1);
  });

  test("returns last phase for months beyond range", () => {
    expect(getCurrentPhase(10, phases)).toBe(2);
    expect(getCurrentPhase(999, phases)).toBe(2);
  });

  test("returns 0 for single phase", () => {
    expect(getCurrentPhase(0, [{ name: "X", months: [0], weights: {} }])).toBe(
      0,
    );
  });

  test("returns 0 for negative months", () => {
    expect(getCurrentPhase(-1, phases)).toBe(0);
  });

  test("handles boundary months correctly", () => {
    expect(getCurrentPhase(1, phases)).toBe(0);
    expect(getCurrentPhase(3, phases)).toBe(1);
    expect(getCurrentPhase(4, phases)).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// getSuggestedSessionIndex
// ═══════════════════════════════════════════════════════════════
describe("getSuggestedSessionIndex", () => {
  const phases: Phase[] = [
    {
      name: "Fondamenta",
      months: [0, 1],
      weights: { Anapana: 75, "Body Scan": 15, Camminata: 10 },
    },
  ];
  const sessionMap: Record<string, number> = {
    Anapana: 0,
    "Body Scan": 1,
    Metta: 2,
    Vipassana: 3,
    Camminata: 4,
    Pensieri: 5,
    Suono: 6,
  };

  test("returns a valid session index", () => {
    const idx = getSuggestedSessionIndex(0, phases, 100, sessionMap);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(6);
  });

  test("deterministic for same day", () => {
    const a = getSuggestedSessionIndex(0, phases, 42, sessionMap);
    const b = getSuggestedSessionIndex(0, phases, 42, sessionMap);
    expect(a).toBe(b);
  });

  test("mostly returns Anapana for phase 0 (75% weight)", () => {
    let anapanaCount = 0;
    for (let d = 0; d < 100; d++) {
      if (getSuggestedSessionIndex(0, phases, d, sessionMap) === 0)
        anapanaCount++;
    }
    expect(anapanaCount).toBeGreaterThan(60);
  });

  test("returns 0 for out-of-bounds phase index", () => {
    expect(getSuggestedSessionIndex(-1, phases, 1, sessionMap)).toBe(0);
    expect(getSuggestedSessionIndex(99, phases, 1, sessionMap)).toBe(0);
  });

  test("returns 0 for empty weights", () => {
    const emptyPhases: Phase[] = [
      { name: "Empty", months: [0], weights: {} },
    ];
    expect(getSuggestedSessionIndex(0, emptyPhases, 1, sessionMap)).toBe(0);
  });

  test("handles negative dayOfYear", () => {
    const idx = getSuggestedSessionIndex(0, phases, -5, sessionMap);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  test("handles unknown session keys in weights (falls back to 0)", () => {
    const weirdPhases: Phase[] = [
      { name: "Weird", months: [0], weights: { UnknownType: 100 } },
    ];
    const idx = getSuggestedSessionIndex(0, weirdPhases, 1, sessionMap);
    expect(idx).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Result pattern
// ═══════════════════════════════════════════════════════════════
describe("Result helpers", () => {
  test("ok wraps value", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  test("err wraps error", () => {
    const r = err("something broke");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("something broke");
  });
});

// ═══════════════════════════════════════════════════════════════
// parseSessionInput
// ═══════════════════════════════════════════════════════════════
describe("parseSessionInput", () => {
  test("accepts valid input", () => {
    const r = parseSessionInput({ date: "2024-03-15", duration_min: 10, session_type: "Anapana" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.date).toBe("2024-03-15");
      expect(r.value.duration_min).toBe(10);
      expect(r.value.session_type).toBe("Anapana");
    }
  });

  test("clamps duration to max", () => {
    const r = parseSessionInput({ date: "2024-03-15", duration_min: 9999 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.duration_min).toBe(480);
  });

  test("defaults missing duration to 0", () => {
    const r = parseSessionInput({ date: "2024-03-15" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.duration_min).toBe(0);
  });

  test("defaults missing session_type to null", () => {
    const r = parseSessionInput({ date: "2024-03-15" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.session_type).toBeNull();
  });

  test("truncates long session_type", () => {
    const long = "A".repeat(300);
    const r = parseSessionInput({ date: "2024-03-15", session_type: long });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.session_type!.length).toBe(200);
  });

  test("rejects null body", () => {
    const r = parseSessionInput(null);
    expect(r.ok).toBe(false);
  });

  test("rejects non-object body", () => {
    expect(parseSessionInput("string").ok).toBe(false);
    expect(parseSessionInput(42).ok).toBe(false);
    expect(parseSessionInput(true).ok).toBe(false);
  });

  test("rejects invalid date", () => {
    expect(parseSessionInput({ date: "not-a-date" }).ok).toBe(false);
    expect(parseSessionInput({ date: "" }).ok).toBe(false);
    expect(parseSessionInput({ date: 42 }).ok).toBe(false);
    expect(parseSessionInput({}).ok).toBe(false);
  });

  test("handles NaN duration gracefully", () => {
    const r = parseSessionInput({ date: "2024-03-15", duration_min: NaN });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.duration_min).toBe(0);
  });

  test("handles negative duration", () => {
    const r = parseSessionInput({ date: "2024-03-15", duration_min: -10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.duration_min).toBe(0);
  });

  test("handles non-string session_type", () => {
    const r = parseSessionInput({ date: "2024-03-15", session_type: 42 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.session_type).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// parseDeleteId
// ═══════════════════════════════════════════════════════════════
describe("parseDeleteId", () => {
  test("accepts valid id", () => {
    const r = parseDeleteId("42");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  test("floors decimal ids", () => {
    const r = parseDeleteId("42.7");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  test("rejects null", () => {
    expect(parseDeleteId(null).ok).toBe(false);
  });

  test("rejects empty string", () => {
    expect(parseDeleteId("").ok).toBe(false);
  });

  test("rejects non-numeric string", () => {
    expect(parseDeleteId("abc").ok).toBe(false);
  });

  test("rejects zero", () => {
    expect(parseDeleteId("0").ok).toBe(false);
  });

  test("rejects negative", () => {
    expect(parseDeleteId("-5").ok).toBe(false);
  });
});
