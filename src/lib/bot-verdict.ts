import { BOT_SCORE_THRESHOLD } from "./bot-score";

export type Verdict = "human" | "unverified" | "bot";

/**
 * Read-time verdict (no row is ever rewritten):
 * bot = bot_score >= threshold OR visitor_hash in the LEGACY bot_hashes table;
 * human = human = 1; everything else = unverified.
 * Bot wins over human: a scripted client can send `engage` too.
 * LEGACY: the bot_hashes clause goes away when the old flag buttons are removed.
 */
export const BOT_SQL = `(COALESCE(bot_score, 0) >= ${BOT_SCORE_THRESHOLD} OR (visitor_hash IS NOT NULL AND visitor_hash IN (SELECT hash FROM bot_hashes)))`;
export const HUMAN_SQL = `(NOT ${BOT_SQL} AND COALESCE(human, 0) = 1)`;
export const UNVERIFIED_SQL = `(NOT ${BOT_SQL} AND COALESCE(human, 0) = 0)`;
export const VERDICT_SQL = `(CASE WHEN ${BOT_SQL} THEN 'bot' WHEN COALESCE(human, 0) = 1 THEN 'human' ELSE 'unverified' END)`;
/** Old behaviour: only the manual per-hash flag excludes. */
export const NOT_LEGACY_BOT_SQL = `(visitor_hash IS NULL OR visitor_hash NOT IN (SELECT hash FROM bot_hashes))`;

export function verdictOf(row: {
  bot_score?: number | null;
  human?: number | null;
  legacyFlagged?: boolean;
}): Verdict {
  if ((row.bot_score ?? 0) >= BOT_SCORE_THRESHOLD || row.legacyFlagged)
    return "bot";
  return (row.human ?? 0) === 1 ? "human" : "unverified";
}
