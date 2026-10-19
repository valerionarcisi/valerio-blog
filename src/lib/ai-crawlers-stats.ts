import type { Client } from "@libsql/client";
import { AI_KIND_BY_BOT } from "./ai-crawlers";
import { HUMAN_SQL } from "./bot-verdict";
import { tableExists } from "./analytics-rollup";

export interface AiCrawlStats {
  available: boolean;
  total: number;
  by_bot: { bot: string; vendor: string; kind: string; hits: number }[];
  by_page: { pathname: string; hits: number; bots: string[] }[];
  daily: { day: string; hits: number }[];
  /** People sent by an assistant (channel "ai"): the value side of being read by AI bots. */
  human: {
    available: boolean;
    sessions: number;
    by_source: { source: string; sessions: number }[];
    by_page: { pathname: string; sessions: number }[];
  };
}

const n = (v: unknown) => Number(v) || 0;

export async function aiCrawlStats(db: Client, from: string, to: string): Promise<AiCrawlStats> {
  const out: AiCrawlStats = {
    available: false,
    total: 0,
    by_bot: [],
    by_page: [],
    daily: [],
    human: { available: false, sessions: 0, by_source: [], by_page: [] },
  };
  const range = [from, to];

  if (await tableExists(db, "ai_crawls")) {
    out.available = true;
    const where = "WHERE day >= ? AND day <= ?";
    const [bots, pages, pageBots, daily] = await Promise.all([
      db.execute({ sql: `SELECT bot, SUM(hits) AS h FROM ai_crawls ${where} GROUP BY bot ORDER BY h DESC`, args: range }),
      db.execute({
        sql: `SELECT pathname, SUM(hits) AS h FROM ai_crawls ${where} GROUP BY pathname ORDER BY h DESC, pathname LIMIT 30`,
        args: range,
      }),
      db.execute({ sql: `SELECT DISTINCT pathname, bot FROM ai_crawls ${where}`, args: range }),
      db.execute({ sql: `SELECT day, SUM(hits) AS h FROM ai_crawls ${where} GROUP BY day ORDER BY day`, args: range }),
    ]);
    const botsOf = new Map<string, string[]>();
    for (const r of pageBots.rows) {
      const p = String(r.pathname);
      botsOf.set(p, [...(botsOf.get(p) ?? []), String(r.bot)].sort());
    }
    out.by_bot = bots.rows.map((r) => {
      const meta = AI_KIND_BY_BOT[String(r.bot)];
      return { bot: String(r.bot), vendor: meta?.vendor ?? "?", kind: meta?.kind ?? "?", hits: n(r.h) };
    });
    out.total = out.by_bot.reduce((s, b) => s + b.hits, 0);
    out.by_page = pages.rows.map((r) => ({ pathname: String(r.pathname), hits: n(r.h), bots: botsOf.get(String(r.pathname)) ?? [] }));
    out.daily = daily.rows.map((r) => ({ day: String(r.day), hits: n(r.h) }));
  }

  if (await tableExists(db, "sessions")) {
    out.human.available = true;
    const where = `WHERE day >= ? AND day <= ? AND channel = 'ai' AND ${HUMAN_SQL}`;
    const [total, sources, pages] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) AS s FROM sessions ${where}`, args: range }),
      db.execute({
        sql: `SELECT COALESCE(referrer, '(utm)') AS src, COUNT(*) AS s FROM sessions ${where} GROUP BY src ORDER BY s DESC LIMIT 10`,
        args: range,
      }),
      db.execute({
        sql: `SELECT entry_path AS p, COUNT(*) AS s FROM sessions ${where} AND entry_path IS NOT NULL GROUP BY p ORDER BY s DESC LIMIT 15`,
        args: range,
      }),
    ]);
    out.human.sessions = n(total.rows[0]?.s);
    out.human.by_source = sources.rows.map((r) => ({ source: String(r.src), sessions: n(r.s) }));
    out.human.by_page = pages.rows.map((r) => ({ pathname: String(r.p), sessions: n(r.s) }));
  }
  return out;
}
