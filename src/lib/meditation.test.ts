import { describe, test, expect } from "vitest";
import {
  parseDuration,
  buildGuidedSchedule,
  generateWavDataUri,
  getMonthsOfPractice,
  getCurrentPhase,
  getSuggestedSessionIndex,
} from "./meditation";
import type { Step, Phase } from "./meditation";

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
});

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

  test("scales durations to fill total time", () => {
    const schedule = buildGuidedSchedule(steps, 600);
    const totalScheduled = schedule.reduce((s, e) => s + e.duration, 0);
    expect(totalScheduled).toBeGreaterThan(0);
    expect(totalScheduled).toBeLessThanOrEqual(600);
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
});

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
});

describe("getMonthsOfPractice", () => {
  test("returns 0 for empty dates", () => {
    expect(getMonthsOfPractice([])).toBe(0);
  });

  test("returns 0 for recent start", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(getMonthsOfPractice([today])).toBe(0);
  });
});

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
  });

  test("returns 0 for empty phases edge case", () => {
    expect(getCurrentPhase(0, [{ name: "X", months: [0], weights: {} }])).toBe(
      0,
    );
  });
});

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
});
