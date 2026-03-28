import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { parseSessionInput, parseDeleteId } from "~/lib/meditation";
import { jsonOk, jsonErr, parseJsonBody } from "~/lib/result";

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meditation_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      duration_min INTEGER DEFAULT 0,
      session_type TEXT,
      created_at TEXT
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_meditation_date ON meditation_sessions(date)`,
  );
  tableReady = true;
}

export const prerender = false;

export const GET: APIRoute = async () => {
  await ensureTable();

  const result = await getDb().execute(
    "SELECT id, date, duration_min, session_type, created_at FROM meditation_sessions WHERE date >= date('now', '-365 days') ORDER BY date ASC, id ASC",
  );

  return jsonOk(result.rows);
};

export const POST: APIRoute = async ({ request }) => {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseSessionInput(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  await ensureTable();
  const { date, duration_min, session_type } = parsed.value;

  const result = await getDb().execute({
    sql: `INSERT INTO meditation_sessions (date, duration_min, session_type, created_at) VALUES (?, ?, ?, datetime('now'))`,
    args: [date, duration_min, session_type],
  });

  return jsonOk({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

export const DELETE: APIRoute = async ({ url }) => {
  const parsed = parseDeleteId(url.searchParams.get("id"));
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  await ensureTable();
  await getDb().execute({
    sql: "DELETE FROM meditation_sessions WHERE id = ?",
    args: [parsed.value],
  });

  return jsonOk({ ok: true });
};
