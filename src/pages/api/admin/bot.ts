import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  isValidDate,
  parseJsonBody,
} from "~/lib/result";

export const prerender = false;

type BotAction =
  | { type: "flagSuspicious"; from: string; to: string }
  | { type: "bulkHash"; hashes: string[] }
  | { type: "singleHash"; hash: string };

function parseBotAction(body: unknown): Result<BotAction> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const b = body as Record<string, unknown>;

  if (b.flagSuspicious && b.from && b.to) {
    if (!isValidDate(b.from) || !isValidDate(b.to))
      return err("Invalid date range");
    return ok({ type: "flagSuspicious", from: b.from, to: b.to });
  }

  if (Array.isArray(b.hashes)) {
    const valid = b.hashes.filter(
      (h: unknown) => typeof h === "string" && h.length > 0 && h.length <= 32,
    );
    if (valid.length === 0) return err("No valid hashes");
    return ok({ type: "bulkHash", hashes: valid });
  }

  if (typeof b.hash === "string" && b.hash.length > 0 && b.hash.length <= 32) {
    return ok({ type: "singleHash", hash: b.hash });
  }

  return err("Invalid hash");
}

async function recalcUniqueForHashes(
  db: ReturnType<typeof getDb>,
  hashes: string[],
) {
  for (const h of hashes) {
    await db.execute({
      sql: "UPDATE pageviews SET is_unique = 0 WHERE visitor_hash = ?",
      args: [h],
    });
  }
}

async function insertAndRecalc(
  db: ReturnType<typeof getDb>,
  hashes: string[],
): Promise<Response> {
  const placeholders = hashes.map(() => "(?)").join(",");
  await db.execute({
    sql: `INSERT OR IGNORE INTO bot_hashes (hash) VALUES ${placeholders}`,
    args: hashes,
  });
  await recalcUniqueForHashes(db, hashes);
  return jsonOk({ ok: true, flagged: hashes.length });
}

export const POST: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseBotAction(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const db = getDb();
  const action = parsed.value;

  if (action.type === "flagSuspicious") {
    const suspects = await db.execute({
      sql: `SELECT DISTINCT visitor_hash FROM pageviews WHERE created_at >= ? AND created_at < datetime(?, '+1 day') AND visitor_hash IS NOT NULL AND visitor_hash NOT IN (SELECT hash FROM bot_hashes) AND (time_on_page IS NULL OR time_on_page <= 5) AND (scroll_depth IS NULL OR scroll_depth = 0)`,
      args: [action.from, action.to],
    });
    const hashes = suspects.rows.map((r) => String(r.visitor_hash));
    if (hashes.length === 0) return jsonOk({ ok: true, flagged: 0 });
    return insertAndRecalc(db, hashes);
  }

  if (action.type === "bulkHash") {
    return insertAndRecalc(db, action.hashes);
  }

  return insertAndRecalc(db, [action.hash]);
};
