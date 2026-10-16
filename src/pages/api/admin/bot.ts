import type { APIRoute } from "astro";
import { timeSafeEqual } from "~/lib/auth";
import { requireAdmin } from "~/lib/admin-auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import { invalidateDays } from "~/lib/analytics-rollup";
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
  | { type: "singleHash"; hash: string }
  | { type: "sessionHash"; sessionId: number };

type BotUnflagAction =
  | { type: "unflagHash"; hash: string }
  | { type: "unflagHashes"; hashes: string[] }
  | { type: "unflagRecent"; minutes: number }
  | { type: "unflagAll" };

const MAX_HASHES = 500;
const MAX_HASH_LEN = 32;

function isValidHash(h: unknown): h is string {
  return typeof h === "string" && h.length > 0 && h.length <= MAX_HASH_LEN;
}

function validHashes(input: unknown[]): Result<string[]> {
  if (input.length > MAX_HASHES)
    return err(`Too many hashes (max ${MAX_HASHES})`);
  const valid = input.filter(isValidHash);
  if (valid.length === 0) return err("No valid hashes");
  return ok([...new Set(valid)]);
}

function parseBotAction(body: unknown): Result<BotAction> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const b = body as Record<string, unknown>;

  if (b.flagSuspicious && b.from && b.to) {
    if (!isValidDate(b.from) || !isValidDate(b.to))
      return err("Invalid date range");
    return ok({ type: "flagSuspicious", from: b.from, to: b.to });
  }

  if (Array.isArray(b.hashes)) {
    const valid = validHashes(b.hashes);
    if (!valid.ok) return valid;
    return ok({ type: "bulkHash", hashes: valid.value });
  }

  if (isValidHash(b.hash)) {
    return ok({ type: "singleHash", hash: b.hash });
  }

  // LEGACY: the "Utenti" panel never sees the visitor hash, so it flags by session id.
  if (typeof b.sessionId === "number" && Number.isInteger(b.sessionId) && b.sessionId > 0) {
    return ok({ type: "sessionHash", sessionId: b.sessionId });
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
    const valid = validHashes(b.hashes);
    if (!valid.ok) return valid;
    return ok({ type: "unflagHashes", hashes: valid.value });
  }

  if (isValidHash(b.hash)) {
    return ok({ type: "unflagHash", hash: b.hash });
  }

  return err("Invalid input");
}

type Db = ReturnType<typeof getDb>;
type Stmt = { sql: string; args: string[] };

function clearUniqueStmts(hashes: string[]): Stmt[] {
  return hashes.map((h) => ({
    sql: "UPDATE pageviews SET is_unique = 0 WHERE visitor_hash = ?",
    args: [h],
  }));
}

function restoreUniqueStmts(hashes: string[]): Stmt[] {
  return hashes.flatMap((h) => [
    {
      sql: "UPDATE pageviews SET is_unique = 0 WHERE visitor_hash = ?",
      args: [h],
    },
    {
      sql: `UPDATE pageviews SET is_unique = 1
            WHERE id IN (
              SELECT MIN(id) FROM pageviews
              WHERE visitor_hash = ?
              GROUP BY date(created_at)
            )`,
      args: [h],
    },
  ]);
}

function deleteHashesStmt(hashes: string[]): Stmt {
  const placeholders = hashes.map(() => "?").join(",");
  return {
    sql: `DELETE FROM bot_hashes WHERE hash IN (${placeholders})`,
    args: hashes,
  };
}

const INVALIDATE_CHUNK = 500;
const INVALIDATE_MAX_DAYS = 120;

/**
 * Best-effort: flagging/unflagging hashes changes numbers of PAST days whose
 * rollups are already written. Forget those days' rollup_log rows so /api/stats
 * reads them from raw again (until the next rollup). Never throws; capped.
 */
async function invalidateRollups(db: Db, hashes: string[]): Promise<void> {
  try {
    const days = new Set<string>();
    for (
      let i = 0;
      i < hashes.length && days.size < INVALIDATE_MAX_DAYS;
      i += INVALIDATE_CHUNK
    ) {
      const chunk = hashes.slice(i, i + INVALIDATE_CHUNK);
      const r = await db.execute({
        sql: `SELECT DISTINCT date(created_at) AS day FROM pageviews WHERE visitor_hash IN (${chunk.map(() => "?").join(",")}) LIMIT ${INVALIDATE_MAX_DAYS}`,
        args: chunk,
      });
      for (const row of r.rows) days.add(String(row.day));
    }
    await invalidateDays(db, [...days].slice(0, INVALIDATE_MAX_DAYS));
  } catch {
    // best effort
  }
}

async function insertAndRecalc(db: Db, hashes: string[]): Promise<Response> {
  const placeholders = hashes.map(() => "(?)").join(",");
  await db.batch(
    [
      {
        sql: `INSERT OR IGNORE INTO bot_hashes (hash) VALUES ${placeholders}`,
        args: hashes,
      },
      ...clearUniqueStmts(hashes),
    ],
    "write",
  );
  await invalidateRollups(db, hashes);
  return jsonOk({ ok: true, flagged: hashes.length });
}

async function deleteAndRestore(db: Db, hashes: string[]): Promise<Response> {
  await db.batch(
    [deleteHashesStmt(hashes), ...restoreUniqueStmts(hashes)],
    "write",
  );
  await invalidateRollups(db, hashes);
  return jsonOk({ ok: true, unflagged: hashes.length });
}

const GENERIC_ERROR = "Internal error";

async function handlePost(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;

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

  if (action.type === "sessionHash") {
    const row = await db.execute({
      sql: "SELECT visitor_hash FROM sessions WHERE id = ?",
      args: [action.sessionId],
    });
    if (!row.rows[0]) return jsonErr("Session not found", 404);
    return insertAndRecalc(db, [String(row.rows[0].visitor_hash)]);
  }

  return insertAndRecalc(db, [action.hash]);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await handlePost(request);
  } catch (e) {
    console.error("[admin/bot POST]", e);
    return jsonErr(GENERIC_ERROR, 500);
  }
};

async function handleDelete(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;

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
}

export const DELETE: APIRoute = async ({ request }) => {
  try {
    return await handleDelete(request);
  } catch (e) {
    console.error("[admin/bot DELETE]", e);
    return jsonErr(GENERIC_ERROR, 500);
  }
};

export const GET: APIRoute = async ({ url, request }) => {
  const token = url.searchParams.get("token") ?? "";
  if (requireAdmin(request) && !timeSafeEqual(token, env("ADMIN_TOKEN"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (url.searchParams.get("recover") !== "all") {
    return new Response(
      "Usage: GET /api/admin/bot?recover=all (admin session cookie, Bearer, or &token=ADMIN_TOKEN)",
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
      await db.batch(
        [deleteHashesStmt(hashes), ...restoreUniqueStmts(hashes)],
        "write",
      );
      await invalidateRollups(db, hashes);
    }

    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Recover</title><body style="font-family:system-ui;padding:2rem;max-width:600px"><h1>OK — ${hashes.length} hash sbloccati</h1><p>bot_hashes svuotata, is_unique ricalcolato.</p><p><a id="dash" href="/admin/analytics">→ Torna alla dashboard</a></p></body>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    console.error("[admin/bot GET recover]", e);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Recover error</title><body style="font-family:system-ui;padding:2rem;max-width:680px"><h1>Errore</h1><p>Errore interno, vedi i log del server.</p></body>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
};
