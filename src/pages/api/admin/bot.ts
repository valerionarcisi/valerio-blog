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

type BotUnflagAction =
  | { type: "unflagHash"; hash: string }
  | { type: "unflagHashes"; hashes: string[] }
  | { type: "unflagRecent"; minutes: number }
  | { type: "unflagAll" };

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

function parseBotUnflagAction(body: unknown): Result<BotUnflagAction> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const b = body as Record<string, unknown>;

  if (b.all === true) {
    return ok({ type: "unflagAll" });
  }

  if (typeof b.recentMinutes === "number") {
    const n = Math.floor(b.recentMinutes);
    if (!Number.isFinite(n) || n <= 0 || n > 1440)
      return err("recentMinutes must be 1..1440");
    return ok({ type: "unflagRecent", minutes: n });
  }

  if (Array.isArray(b.hashes)) {
    const valid = b.hashes.filter(
      (h: unknown) => typeof h === "string" && h.length > 0 && h.length <= 32,
    );
    if (valid.length === 0) return err("No valid hashes");
    return ok({ type: "unflagHashes", hashes: valid });
  }

  if (typeof b.hash === "string" && b.hash.length > 0 && b.hash.length <= 32) {
    return ok({ type: "unflagHash", hash: b.hash });
  }

  return err("Invalid input");
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

async function restoreUniqueForHashes(
  db: ReturnType<typeof getDb>,
  hashes: string[],
) {
  for (const h of hashes) {
    await db.execute({
      sql: "UPDATE pageviews SET is_unique = 0 WHERE visitor_hash = ?",
      args: [h],
    });
    await db.execute({
      sql: `UPDATE pageviews SET is_unique = 1
            WHERE id IN (
              SELECT MIN(id) FROM pageviews
              WHERE visitor_hash = ?
              GROUP BY date(created_at)
            )`,
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

async function deleteAndRestore(
  db: ReturnType<typeof getDb>,
  hashes: string[],
): Promise<Response> {
  const placeholders = hashes.map(() => "?").join(",");
  await db.execute({
    sql: `DELETE FROM bot_hashes WHERE hash IN (${placeholders})`,
    args: hashes,
  });
  await restoreUniqueForHashes(db, hashes);
  return jsonOk({ ok: true, unflagged: hashes.length });
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

export const DELETE: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseBotUnflagAction(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const db = getDb();
  const action = parsed.value;

  if (action.type === "unflagAll") {
    const all = await db.execute({
      sql: "SELECT hash FROM bot_hashes",
      args: [],
    });
    const hashes = all.rows.map((r) => String(r.hash));
    if (hashes.length === 0) return jsonOk({ ok: true, unflagged: 0 });
    return deleteAndRestore(db, hashes);
  }

  if (action.type === "unflagRecent") {
    const cutoff = new Date(Date.now() - action.minutes * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const recent = await db.execute({
      sql: "SELECT hash FROM bot_hashes WHERE created_at >= ?",
      args: [cutoff],
    });
    const hashes = recent.rows.map((r) => String(r.hash));
    if (hashes.length === 0) return jsonOk({ ok: true, unflagged: 0 });
    return deleteAndRestore(db, hashes);
  }

  if (action.type === "unflagHashes") {
    return deleteAndRestore(db, action.hashes);
  }

  return deleteAndRestore(db, [action.hash]);
};

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token") ?? "";
  if (token.length === 0 || token !== env("ADMIN_TOKEN")) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (url.searchParams.get("recover") !== "all") {
    return new Response(
      "Usage: GET /api/admin/bot?recover=all&token=ADMIN_TOKEN",
      { status: 400, headers: { "Content-Type": "text/plain" } },
    );
  }

  try {
    const db = getDb();
    const all = await db.execute({
      sql: "SELECT hash FROM bot_hashes",
      args: [],
    });
    const hashes = all.rows.map((r) => String(r.hash));

    if (hashes.length > 0) {
      const placeholders = hashes.map(() => "?").join(",");
      await db.execute({
        sql: `DELETE FROM bot_hashes WHERE hash IN (${placeholders})`,
        args: hashes,
      });
      await restoreUniqueForHashes(db, hashes);
    }

    const dashHref = `/admin/analytics?token=${encodeURIComponent(token)}`;
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Recover</title><body style="font-family:system-ui;padding:2rem;max-width:600px"><h1>OK — ${hashes.length} hash sbloccati</h1><p>bot_hashes svuotata, is_unique ricalcolato.</p><p><a href="${dashHref}">→ Torna alla dashboard</a></p></body>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Recover error</title><body style="font-family:system-ui;padding:2rem;max-width:680px"><h1>Errore</h1><pre style="background:#f5f5f5;padding:1rem;overflow:auto">${msg.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</pre></body>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
};
