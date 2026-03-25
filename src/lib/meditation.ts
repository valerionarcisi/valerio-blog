export function parseDuration(dur: string): number {
  const m = dur.match(/(\d+)/);
  return m ? parseInt(m[1]) * 60 : 0;
}

export interface Step {
  t: string;
  d: string;
  dur: string;
}

export interface ScheduleEntry {
  at: number;
  title: string;
  desc: string;
  duration: number;
  idx: number;
}

export function buildGuidedSchedule(
  steps: Step[],
  totalSec: number,
): ScheduleEntry[] {
  let totalDeclared = 0;
  steps.forEach((s) => {
    totalDeclared += parseDuration(s.dur);
  });
  const scale = totalDeclared > 0 ? totalSec / totalDeclared : 1;
  const schedule: ScheduleEntry[] = [];
  let elapsed = 0;
  steps.forEach((s, i) => {
    let stepSec = Math.round(parseDuration(s.dur) * scale);
    if (stepSec === 0 && i < steps.length - 1)
      stepSec = Math.round(totalSec / steps.length);
    schedule.push({
      at: elapsed,
      title: s.t,
      desc: s.d,
      duration: stepSec,
      idx: i,
    });
    elapsed += stepSec;
  });
  return schedule;
}

export function generateWavDataUri(
  freq: number,
  durationSec: number,
  volume: number,
  decayAt: number,
): string {
  const sr = 22050;
  const n = Math.floor(sr * durationSec);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  function w(o: number, s: string) {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  }
  w(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  const ds = Math.floor(sr * (decayAt || 0));
  for (let i = 0; i < n; i++) {
    const env =
      i < ds
        ? volume
        : volume * Math.exp((-3 * (i - ds)) / (n - ds));
    const val = Math.sin((2 * Math.PI * freq * i) / sr) * env;
    v.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, Math.floor(val * 32767))),
      true,
    );
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

export interface Phase {
  name: string;
  months: number[];
  weights: Record<string, number>;
}

export function getMonthsOfPractice(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates.slice().sort();
  const first = new Date(sorted[0]);
  const now = new Date();
  let months =
    (now.getFullYear() - first.getFullYear()) * 12 +
    (now.getMonth() - first.getMonth());
  const daysDiff = Math.max(
    1,
    Math.round((now.getTime() - first.getTime()) / 86400000),
  );
  const consistency = dates.length / daysDiff;
  if (consistency < 0.3) months = Math.floor((months * consistency) / 0.3);
  return Math.max(0, months);
}

export function getCurrentPhase(months: number, phases: Phase[]): number {
  for (let i = phases.length - 1; i >= 0; i--) {
    const p = phases[i];
    const lastMonth = p.months[p.months.length - 1];
    if (i === phases.length - 1 && months >= p.months[0]) return i;
    if (months >= p.months[0] && months <= lastMonth) return i;
  }
  return 0;
}

export function getSuggestedSessionIndex(
  phaseIdx: number,
  phases: Phase[],
  dayOfYear: number,
  sessionMap: Record<string, number>,
): number {
  const p = phases[phaseIdx];
  const w = p.weights;
  const pool: number[] = [];
  Object.keys(w).forEach((k) => {
    const idx = sessionMap[k] !== undefined ? sessionMap[k] : 0;
    for (let i = 0; i < w[k]; i++) pool.push(idx);
  });
  return pool[dayOfYear % pool.length];
}
