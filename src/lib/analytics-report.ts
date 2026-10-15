import type { Client } from "@libsql/client";
// Relative imports only: this module is bundled into a Netlify function (no `~/` alias).
import { computeBlock, computeSessions } from "./stats-hybrid";
import { computeVitals } from "./analytics-vitals-stats";
import { VERDICT_SQL } from "./bot-verdict";
import { rate, type Rating } from "./analytics-vitals";
import { isoDate } from "./date-range";

/**
 * Weekly Telegram report. The week is Monday-Sunday by Europe/Rome calendar
 * dates, mapped 1:1 onto the analytics UTC days (a few hours of boundary
 * skew, irrelevant for a weekly summary). Numbers are human visits only, like
 * the dashboard.
 */
export const DASHBOARD_URL = "https://valerionarcisi.me/admin/analytics";
const TZ = "Europe/Rome";

export interface WeekRange {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** Last full Mon-Sun week (Rome dates) before `now`, plus the week before it. */
export function lastFullWeek(now: Date = new Date()): WeekRange {
  const romeToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const dow = new Date(romeToday + "T00:00:00Z").getUTCDay(); // 0 = Sunday
  const thisMonday = addDays(romeToday, -((dow + 6) % 7));
  const from = addDays(thisMonday, -7);
  return { from, to: addDays(thisMonday, -1), prevFrom: addDays(from, -7), prevTo: addDays(from, -1) };
}

export interface ReportData {
  week: WeekRange;
  visitors: number;
  pageviews: number;
  prevVisitors: number;
  prevPageviews: number;
  verdicts: { human: number; unverified: number } | null;
  topPosts: Array<{ pathname: string; visitors: number }>;
  channels: Array<{ channel: string; visitors: number }>;
  goals: Array<{ label: string; conversions: number; rate: number }>;
  lcpMobile: { p75: number; n: number } | null;
}

const isPost = (p: string) => /^(\/en)?\/blog\/./.test(p);

export async function buildReportData(db: Client, now: Date = new Date()): Promise<ReportData> {
  const week = lastFullWeek(now);
  const today = isoDate(now);
  const base = { groupBy: "day", includeAll: false, today };
  const [cur, prev, sess, vitals] = await Promise.all([
    computeBlock(db, { ...base, from: week.from, to: week.to, full: true }),
    computeBlock(db, { ...base, from: week.prevFrom, to: week.prevTo, totalsOnly: true }),
    computeSessions(db, { ...base, from: week.from, to: week.to }),
    computeVitals(db, { ...base, from: week.from, to: week.to }),
  ]);

  let verdicts: ReportData["verdicts"];
  try {
    const q = await db.execute({
      sql: `SELECT ${VERDICT_SQL} AS verdict, COALESCE(SUM(is_unique), 0) AS visits FROM pageviews
            WHERE created_at >= ? AND created_at < datetime(?, '+1 day') GROUP BY verdict`,
      args: [week.from, week.to],
    });
    const v = { human: 0, unverified: 0 };
    for (const r of q.rows) {
      const k = String(r.verdict);
      if (k === "human" || k === "unverified") v[k] = Number(r.visits) || 0;
    }
    verdicts = v;
  } catch {
    verdicts = null; // raw rows pruned or migration missing: the line is simply omitted
  }

  const lcp = vitals.available ? vitals.by_device.mobile?.lcp : null;
  return {
    week,
    visitors: cur.totals.visitors,
    pageviews: cur.totals.pageviews,
    prevVisitors: prev.totals.visitors,
    prevPageviews: prev.totals.pageviews,
    verdicts,
    topPosts: cur.topPages
      .filter((r) => isPost(String(r.pathname)))
      .slice(0, 3)
      .map((r) => ({ pathname: String(r.pathname), visitors: Number(r.visitors) || 0 })),
    channels: cur.channels
      .slice(0, 3)
      .map((r) => ({ channel: String(r.channel), visitors: Number(r.visitors) || 0 })),
    goals: sess.goals
      .filter((g) => g.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 2)
      .map((g) => ({ label: g.label, conversions: g.conversions, rate: g.rate })),
    lcpMobile: lcp && lcp.n > 0 && lcp.p75 != null ? { p75: lcp.p75, n: lcp.n } : null,
  };
}

// ---- formatting (pure) ----

const nf = new Intl.NumberFormat("it-IT");
const num = (n: number) => nf.format(n);
const pct1 = (n: number) => n.toFixed(1).replace(".", ",");

function delta(curr: number, prev: number): string {
  if (prev <= 0) return curr > 0 ? "nuovo" : "=";
  const p = Math.round(((curr - prev) / prev) * 1000) / 10;
  if (p === 0) return "=";
  return `${p > 0 ? "+" : "-"}${pct1(Math.abs(p))}%`;
}

function weekLabel(w: WeekRange): string {
  const f = (iso: string, withMonth = true) =>
    new Intl.DateTimeFormat("it-IT", {
      timeZone: "UTC",
      day: "numeric",
      ...(withMonth ? { month: "long" } : {}),
    }).format(new Date(iso + "T00:00:00Z"));
  const sameMonth = w.from.slice(0, 7) === w.to.slice(0, 7);
  return `${f(w.from, !sameMonth)}-${f(w.to)} ${w.to.slice(0, 4)}`;
}

const RATING_IT: Record<Rating, string> = { good: "buono", ni: "da migliorare", poor: "scarso" };

/** Plain text (no parse_mode): nothing to escape, safe for any pathname or label. */
export function formatReport(d: ReportData): string {
  const lines: string[] = [];
  lines.push(`Analytics - settimana ${weekLabel(d.week)}`);
  lines.push("");
  lines.push(`Visitatori: ${num(d.visitors)} (${delta(d.visitors, d.prevVisitors)} vs settimana prima)`);
  lines.push(`Pageview: ${num(d.pageviews)} (${delta(d.pageviews, d.prevPageviews)})`);
  if (d.verdicts) {
    const total = d.verdicts.human + d.verdicts.unverified;
    lines.push(
      total > 0
        ? `Qualita: ${num(d.verdicts.human)} visite umane verificate, ${num(d.verdicts.unverified)} non verificate (${pct1((d.verdicts.unverified / total) * 100)}%, escluse dai numeri sopra)`
        : "Qualita: nessuna visita nel periodo",
    );
  }
  if (d.topPosts.length) {
    lines.push("", "Top post:");
    d.topPosts.forEach((p, i) => lines.push(`${i + 1}. ${p.pathname} - ${num(p.visitors)} visitatori`));
  }
  if (d.channels.length) {
    lines.push("", "Canali: " + d.channels.map((c) => `${c.channel} ${num(c.visitors)}`).join(", "));
  }
  if (d.goals.length) {
    lines.push("Obiettivi: " + d.goals.map((g) => `${g.label} ${num(g.conversions)} (${pct1(g.rate)}%)`).join(", "));
  }
  if (d.lcpMobile) {
    const r = rate("lcp", d.lcpMobile.p75);
    lines.push(`LCP mobile (p75): ${pct1(d.lcpMobile.p75 / 1000)} s - ${RATING_IT[r]}`);
  }
  lines.push("", DASHBOARD_URL);
  return lines.join("\n");
}

// ---- delivery ----

export type EnvGetter = (key: string) => string | undefined;

export function resolveTarget(get: EnvGetter): { token: string; chatId: string } | null {
  const token = get("TELEGRAM_BOT_TOKEN")?.trim();
  const chatId =
    get("ANALYTICS_REPORT_CHAT_ID")?.trim() ||
    get("TELEGRAM_USER_ID_WHITELIST")?.split(",")[0]?.trim();
  return token && chatId ? { token, chatId } : null;
}

export const isReportDisabled = (get: EnvGetter) =>
  ["1", "true"].includes((get("ANALYTICS_REPORT_DISABLED") ?? "").trim().toLowerCase());

export async function sendTelegramText(
  target: { token: string; chatId: string },
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`https://api.telegram.org/bot${target.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: target.chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // the URL embeds the bot token: never propagate the original error message
    throw new Error("Telegram request failed");
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) throw new Error(data.description ?? `Telegram HTTP ${res.status}`);
}

export interface ReportResult {
  text: string;
  sent: boolean;
  dryRun: boolean;
  skipped?: "disabled" | "no_target";
}

export async function runWeeklyReport(
  db: Client,
  get: EnvGetter,
  opts: { send: boolean; now?: Date; fetchImpl?: typeof fetch },
): Promise<ReportResult> {
  const text = formatReport(await buildReportData(db, opts.now));
  if (!opts.send) return { text, sent: false, dryRun: true };
  if (isReportDisabled(get)) return { text, sent: false, dryRun: false, skipped: "disabled" };
  const target = resolveTarget(get);
  if (!target) return { text, sent: false, dryRun: false, skipped: "no_target" };
  await sendTelegramText(target, text, opts.fetchImpl);
  return { text, sent: true, dryRun: false };
}
