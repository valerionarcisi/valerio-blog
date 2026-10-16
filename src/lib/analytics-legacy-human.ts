import type { Client } from "@libsql/client";
import { BOT_SCORE_THRESHOLD } from "./bot-score";

/**
 * One-off backfill for the cutover to the human/unverified/bot model.
 *
 * Pageviews stored BEFORE the `engage` signal existed could never prove a visit was human, so after the
 * migration they all read as "unverified" and drop out of the main numbers. Those rows were counted under
 * the old rule (everything except visitors flagged by hand), so they are marked human with that same rule:
 * not scored as a bot and not in the legacy `bot_hashes` list. Rows from the cutover on keep their real
 * verdict. Idempotent: rows already marked human are never touched.
 */

export interface LegacyHumanPlan {
  /** Cutover in the database's own format (UTC, "YYYY-MM-DD HH:MM:SS"). */
  before: string;
  /** Pageviews that would be (or were) marked human. */
  rows: number;
  /** Rows older than the cutover that stay as they are because they look like bots. */
  keptAsBot: number;
  firstDay: string | null;
  lastDay: string | null;
  perDay: { day: string; rows: number }[];
  applied: boolean;
  updated: number;
}

const DB_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Accepts "2026-10-15", "2026-10-15T14:46", "2026-10-15T14:46:00Z" or the DB format; always UTC. */
export function parseCutover(input: string, now: Date = new Date()): string {
  const s = input.trim();
  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = `${s}T00:00:00Z`;
  else if (DB_TS.test(s)) iso = `${s.replace(" ", "T")}Z`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?$/.test(s))
    iso = /Z$/.test(s) ? s : `${s}Z`;
  else throw new Error(`Invalid cutover "${input}" (use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, UTC)`);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid cutover "${input}"`);
  if (d.getTime() > now.getTime()) throw new Error("The cutover cannot be in the future");
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** The moment the first real engage signal arrived: nothing before it could have been verified. */
export async function detectCutover(db: Client): Promise<string | null> {
  const res = await db.execute(
    "SELECT MIN(created_at) AS first FROM pageviews WHERE human = 1",
  );
  const first = res.rows[0]?.first;
  return first ? String(first) : null;
}

const NOT_BOT = `COALESCE(bot_score, 0) < ${BOT_SCORE_THRESHOLD}
  AND (visitor_hash IS NULL OR visitor_hash NOT IN (SELECT hash FROM bot_hashes))`;

export async function backfillLegacyHuman(
  db: Client,
  opts: { before: string; apply: boolean },
): Promise<LegacyHumanPlan> {
  if (!DB_TS.test(opts.before)) throw new Error("`before` must come from parseCutover()");

  const candidates = `COALESCE(human, 0) = 0 AND created_at < ?`;
  const [count, bots, perDay] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) AS n, MIN(date(created_at)) AS first, MAX(date(created_at)) AS last
            FROM pageviews WHERE ${candidates} AND ${NOT_BOT}`,
      args: [opts.before],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM pageviews WHERE ${candidates} AND NOT (${NOT_BOT})`,
      args: [opts.before],
    }),
    db.execute({
      sql: `SELECT date(created_at) AS day, COUNT(*) AS n FROM pageviews
            WHERE ${candidates} AND ${NOT_BOT} GROUP BY day ORDER BY day`,
      args: [opts.before],
    }),
  ]);

  const rows = Number(count.rows[0]?.n ?? 0);
  const plan: LegacyHumanPlan = {
    before: opts.before,
    rows,
    keptAsBot: Number(bots.rows[0]?.n ?? 0),
    firstDay: count.rows[0]?.first ? String(count.rows[0].first) : null,
    lastDay: count.rows[0]?.last ? String(count.rows[0].last) : null,
    perDay: perDay.rows.map((r) => ({ day: String(r.day), rows: Number(r.n) })),
    applied: false,
    updated: 0,
  };
  if (!opts.apply || rows === 0) return plan;

  const res = await db.execute({
    sql: `UPDATE pageviews SET human = 1 WHERE ${candidates} AND ${NOT_BOT}`,
    args: [opts.before],
  });
  return { ...plan, applied: true, updated: res.rowsAffected };
}
