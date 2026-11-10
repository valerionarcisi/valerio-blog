import { describe, expect, it } from "vitest";
import {
  blockTime,
  buildBlockView,
  buildWeeks,
  formatRange,
  formatTime,
  lapTime,
  lapsLabel,
  nextTimedSession,
  parsePace,
  parsePaceRange,
} from "./training-plan";

describe("training-plan", () => {
  it("converte i ritmi in secondi/km", () => {
    expect(parsePace("4:20")).toBe(260);
    expect(parsePaceRange("4:45-4:50")).toEqual([285, 290]);
    expect(parsePaceRange("fl")).toEqual([315, 320]);
  });

  it("500 m a 4'20\" = 2'10\"", () => {
    expect(formatRange(blockTime(parsePaceRange("4:20"), 500))).toBe(`2'10"`);
  });

  it("giro a 4'45\" = 1'54\"", () => {
    expect(formatRange(lapTime(parsePaceRange("4:45")))).toBe(`1'54"`);
  });

  it("3000 m a 4'45\" = 14'15\"", () => {
    expect(formatTime(blockTime(parsePaceRange("4:45"), 3000)[0])).toBe(`14'15"`);
  });

  it("mostra i giri decimali solo se non multipli di 400", () => {
    expect(lapsLabel(3000)).toBe("7,5 giri");
    expect(lapsLabel(2000)).toBeNull();
  });

  it("totale ripetute: 8×500 a 4'20\" = 17'20\"", () => {
    const v = buildBlockView({ kind: "rep", label: "Ripetute", reps: 8, distance_m: 500, pace: "4:20" });
    expect(v).toMatchObject({ perRep: `2'10"`, perLap: `1'44"`, total: `17'20"`, laps: "1,25 giri" });
  });

  it("intervallo di ritmo: min–max", () => {
    const v = buildBlockView({ kind: "rep", label: "Ritmo", distance_m: 3000, pace: "4:45-4:50" });
    expect(v.total).toBe(`14'15"–14'30"`);
    expect(v.perLap).toBe(`1'54"–1'56"`);
  });

  it("piano: 4 settimane, riposi derivati dalle date, prossima seduta in pista", () => {
    const weeks = buildWeeks();
    expect(weeks).toHaveLength(4);
    expect(weeks[0].restDays).toEqual(["mar", "gio", "sab"]);
    expect(nextTimedSession(weeks, "2026-11-10")).toBe("2026-11-11");
    expect(nextTimedSession(weeks, "2026-11-12")).toBe("2026-11-18");
    expect(nextTimedSession(weeks, "2026-12-07")).toBeNull();
  });
});
