import plan from "~/data/training-plan.json";

export type BlockKind = "easy" | "rep" | "recovery" | "cool" | "fartlek";
export type DayKind = "easy" | "quality" | "race" | "rest";

export interface PlanBlock {
  kind: BlockKind;
  label: string;
  reps?: number;
  distance_m?: number;
  distance_max_m?: number;
  pace?: string;
  note?: string;
}

export interface PlanDay {
  date: string;
  kind: DayKind;
  text?: string;
  summary?: string;
  note?: string;
  blocks?: PlanBlock[];
}

export type Range = readonly [number, number];

const LAP_M = 400;

/** "4:20" -> 260 */
export function parsePace(value: string): number {
  const m = /^(\d+):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Ritmo non valido: ${value}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "4:45-4:50" -> [285, 290]; "fl" usa il ritmo del fondo lento */
export function parsePaceRange(value: string, easyPace: string = plan.easyPace): Range {
  const raw = value === "fl" ? easyPace : value;
  const [from, to = from] = raw.split("-").map(parsePace);
  return [from, to];
}

/** 130 -> 2'10" */
export function formatTime(seconds: number): string {
  // mezzo secondo per difetto: coincide con le tabelle ritmo/distanza usate in pista
  const total = Math.ceil(seconds - 0.5);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min === 0 ? `${sec}"` : `${min}'${String(sec).padStart(2, "0")}"`;
}

export function formatRange([a, b]: Range): string {
  const [fa, fb] = [formatTime(a), formatTime(b)];
  return fa === fb ? fa : `${fa}–${fb}`;
}

const scale = ([a, b]: Range, factor: number): Range => [a * factor, b * factor];

export function blockTime(paceSKm: Range, distanceM: number): Range {
  return scale(paceSKm, distanceM / 1000);
}

export function lapTime(paceSKm: Range): Range {
  return scale(paceSKm, LAP_M / 1000);
}

export interface Split {
  meters: number;
  time: string;
}

const MARK_M = 100;
const MAX_SPLIT_M = 500;

/** Passaggi ai segni ogni 100 m; oltre i 500 m solo il primo giro (poi si ripete) */
export function buildSplits(paceSKm: Range, distanceM: number): { splits: Split[]; repeatsPerLap: boolean } {
  const repeatsPerLap = distanceM > MAX_SPLIT_M;
  const upTo = repeatsPerLap ? LAP_M : distanceM;
  const splits: Split[] = [];
  for (let m = MARK_M; m <= upTo; m += MARK_M) splits.push({ meters: m, time: formatRange(blockTime(paceSKm, m)) });
  return { splits, repeatsPerLap };
}

export function per100Time(paceSKm: Range): Range {
  return scale(paceSKm, 0.1);
}

/** Giri da 400 m in decimale, solo se la distanza non è multipla del giro */
export function lapsLabel(distanceM: number): string | null {
  if (distanceM % LAP_M === 0) return null;
  const laps = distanceM / LAP_M;
  return `${laps.toLocaleString("it-IT", { maximumFractionDigits: 2 })} giri`;
}

export function formatDistance(block: Pick<PlanBlock, "distance_m" | "distance_max_m">): string | null {
  const { distance_m: d, distance_max_m: max } = block;
  if (d === undefined) return null;
  const fmt = (m: number) => (m >= 1000 && m % 500 === 0 ? `${m / 1000} km` : `${m} m`);
  if (max === undefined) return fmt(d);
  return `${d / 1000}–${max / 1000} km`;
}

export interface BlockView {
  kind: BlockKind;
  label: string;
  note?: string;
  reps: number | null;
  distance: string | null;
  laps: string | null;
  pace: string | null;
  perRep: string | null;
  perLap: string | null;
  per100: string | null;
  splits: Split[];
  splitsRepeat: boolean;
  total: string | null;
}

export function buildBlockView(block: PlanBlock, easyPace: string = plan.easyPace): BlockView {
  const reps = block.reps && block.reps > 1 ? block.reps : null;
  const paced = block.pace && block.distance_m !== undefined && block.distance_max_m === undefined;
  const pace = block.pace ? parsePaceRange(block.pace, easyPace) : null;
  const perRep = paced && pace ? blockTime(pace, block.distance_m as number) : null;
  const sp = pace && block.distance_m !== undefined && block.distance_max_m === undefined ? buildSplits(pace, block.distance_m) : null;
  return {
    kind: block.kind,
    label: block.label,
    note: block.note,
    reps,
    distance: formatDistance(block),
    laps: block.distance_m !== undefined ? lapsLabel(block.distance_m) : null,
    pace: pace ? `${formatRange(pace)}/km` : null,
    perRep: perRep ? formatRange(perRep) : null,
    splits: sp?.splits ?? [],
    splitsRepeat: sp?.repeatsPerLap ?? false,
    per100: pace ? formatRange(per100Time(pace)) : null,
    perLap: pace && paced ? formatRange(lapTime(pace)) : null,
    total: perRep ? formatRange(reps && perRep ? scale(perRep, reps) : perRep) : null,
  };
}

export const hasTimings = (day: PlanDay): boolean =>
  day.blocks?.some((b) => b.pace && b.pace !== "fl" && b.distance_m !== undefined) ?? false;

const WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const WEEKDAYS_LONG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

const parseIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const weekdayShort = (iso: string) => WEEKDAYS[parseIso(iso).getUTCDay()];
export const weekdayLong = (iso: string) => WEEKDAYS_LONG[parseIso(iso).getUTCDay()];

export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export interface WeekView {
  number: number;
  from: string;
  to: string;
  trainingDays: PlanDay[];
  restDays: string[];
}

export function buildWeeks(source: { weeks: { days: PlanDay[] }[] } = plan as never): WeekView[] {
  return source.weeks.map((w, i) => ({
    number: i + 1,
    from: w.days[0].date,
    to: w.days[w.days.length - 1].date,
    trainingDays: w.days.filter((d) => d.kind !== "rest"),
    restDays: w.days.filter((d) => d.kind === "rest").map((d) => weekdayShort(d.date)),
  }));
}

/** Prima seduta con tempi (>= oggi), per aprire l'accordion di default */
export function nextTimedSession(weeks: WeekView[], todayIso: string): string | null {
  const days = weeks.flatMap((w) => w.trainingDays);
  return days.find((d) => d.date >= todayIso && hasTimings(d))?.date ?? null;
}

export { plan };

export const TABLE_DISTANCES_M = [100, 200, 300, 400, 500] as const;

export interface PaceRow {
  pace: string;
  times: string[];
}

/** Tutti i ritmi usati nel piano (estremi degli intervalli inclusi), dal più veloce */
export function buildPaceTable(
  weeks: { days: PlanDay[] }[] = plan.weeks as never,
  easyPace: string = plan.easyPace,
): PaceRow[] {
  const paces = new Set<number>();
  for (const day of weeks.flatMap((w) => w.days))
    for (const b of day.blocks ?? [])
      if (b.pace) parsePaceRange(b.pace, easyPace).forEach((p) => paces.add(p));
  return [...paces]
    .sort((a, b) => a - b)
    .map((p) => ({
      pace: formatTime(p),
      times: TABLE_DISTANCES_M.map((m) => formatTime((p * m) / 1000)),
    }));
}
