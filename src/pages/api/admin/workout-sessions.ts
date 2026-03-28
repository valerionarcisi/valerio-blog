import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import { parseJsonBody, jsonOk, jsonErr } from "~/lib/result";

export const prerender = false;

async function ensureTable() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id   TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      duration_sec INTEGER,
      rpe          INTEGER,
      note         TEXT,
      amrap_rounds TEXT
    )
  `);
}

export const GET: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    await ensureTable();
    const db = getDb();

    const [sessions, stats] = await Promise.all([
      db.execute(
        "SELECT * FROM workout_sessions ORDER BY completed_at DESC LIMIT 60",
      ),
      db.execute(`
        SELECT workout_id,
               MAX(completed_at) as last_done,
               COUNT(*) as total
        FROM workout_sessions
        GROUP BY workout_id
      `),
    ]);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const weekCount = await db.execute({
      sql: "SELECT COUNT(*) as n FROM workout_sessions WHERE completed_at >= ?",
      args: [weekStartStr],
    });

    const lastDoneByWorkout: Record<string, string> = {};
    const totalByWorkout: Record<string, number> = {};
    for (const row of stats.rows) {
      lastDoneByWorkout[String(row.workout_id)] = String(row.last_done);
      totalByWorkout[String(row.workout_id)] = Number(row.total);
    }

    return jsonOk({
      sessions: sessions.rows,
      stats: {
        lastDoneByWorkout,
        totalByWorkout,
        weekCount: Number(weekCount.rows[0]?.n ?? 0),
      },
    });
  } catch (e) {
    return jsonErr(String(e), 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const b = bodyResult.value as Record<string, unknown>;
  const workoutId = typeof b.workout_id === "string" ? b.workout_id : null;
  if (!workoutId) return jsonErr("Missing workout_id", 400);

  const durationSec =
    typeof b.duration_sec === "number" ? Math.round(b.duration_sec) : null;
  const rpe =
    typeof b.rpe === "number" ? Math.max(1, Math.min(10, Math.round(b.rpe))) : null;
  const note = typeof b.note === "string" ? b.note.slice(0, 500) : null;
  const amrapRounds =
    b.amrap_rounds && typeof b.amrap_rounds === "object"
      ? JSON.stringify(b.amrap_rounds)
      : null;

  try {
    await ensureTable();
    const db = getDb();
    const result = await db.execute({
      sql: "INSERT INTO workout_sessions (workout_id, duration_sec, rpe, note, amrap_rounds) VALUES (?, ?, ?, ?, ?)",
      args: [workoutId, durationSec, rpe, note, amrapRounds],
    });
    return jsonOk({ id: Number(result.lastInsertRowid) });
  } catch (e) {
    return jsonErr(String(e), 500);
  }
};
