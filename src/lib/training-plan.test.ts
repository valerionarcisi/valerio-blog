import { describe, expect, it } from "vitest";
import {
  blockTime,
  buildBlockView,
  buildPaceTable,
  buildSplits,
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
    const v = buildBlockView({ kind: "rep", label: "Ripetute", reps: 8, distance_m: 500, pace: "4:20" }, undefined, true);
    expect(v).toMatchObject({ perRep: `2'10"`, perLap: `1'44"`, per100: `26"`, total: `17'20"`, laps: "1,25 giri" });
  });

  it("intervallo di ritmo: min–max", () => {
    const v = buildBlockView({ kind: "rep", label: "Ritmo", distance_m: 3000, pace: "4:45-4:50" }, undefined, true);
    expect(v.total).toBe(`14'15"–14'30"`);
    expect(v.perLap).toBe(`1'54"–1'56"`);
    expect(v.per100).toBe(`28"–29"`);
  });

  it("piano: 4 settimane, riposi derivati dalle date, prossima seduta in pista", () => {
    const weeks = buildWeeks();
    expect(weeks).toHaveLength(4);
    expect(weeks[0].restDays).toEqual(["mar", "gio", "sab"]);
    expect(nextTimedSession(weeks, "2026-11-10")).toBe("2026-11-11");
    expect(nextTimedSession(weeks, "2026-11-12")).toBe("2026-11-18");
    expect(nextTimedSession(weeks, "2026-12-07")).toBeNull();
  });

  it("tabella ritmi: coincide con la tabella di riferimento", () => {
    const rows = buildPaceTable();
    const row = (pace: string) => rows.find((r) => r.pace === pace);
    expect(row(`4'20"`)?.times).toEqual([`26"`, `52"`, `1'18"`, `1'44"`, `2'10"`]);
    expect(row(`4'25"`)?.times.slice(1)).toEqual([`53"`, `1'19"`, `1'46"`, `2'12"`]);
    expect(row(`4'35"`)?.times[4]).toBe(`2'17"`);
    expect(row(`4'45"`)?.times[4]).toBe(`2'22"`);
    expect(row(`4'50"`)?.times).toEqual([`29"`, `58"`, `1'27"`, `1'56"`, `2'25"`]);
    expect(row(`5'15"`)).toBeUndefined();
  });

  it("passaggi ogni 100 m: 500 m a 4'20\" fino a 500, oltre solo il primo giro", () => {
    const rep = buildSplits(parsePaceRange("4:20"), 500);
    expect(rep.splits.map((s) => s.time)).toEqual([`26"`, `52"`, `1'18"`, `1'44"`, `2'10"`]);
    expect(rep.repeatsPerLap).toBe(false);
    const long = buildSplits(parsePaceRange("4:45-4:50"), 3000);
    expect(long.splits).toHaveLength(4);
    expect(long.splits[3].time).toBe(`1'54"–1'56"`);
    expect(long.repeatsPerLap).toBe(true);
  });

  it("fuori dalla pista niente tempo ogni 100 m né passaggi", () => {
    const v = buildBlockView({ kind: "rep", label: "Ritmo", distance_m: 6000, pace: "4:45-4:50" });
    expect(v.per100).toBeNull();
    expect(v.splits).toEqual([]);
  });
});
