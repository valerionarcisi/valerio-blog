import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import getDb from "~/lib/turso";
import { parseSessionInput, parseDeleteId } from "~/lib/meditation";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function jsonErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

function isAuthorized(request: Request): boolean {
  return verifyBearerToken(request, import.meta.env.ADMIN_TOKEN);
}

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

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);
  await ensureTable();

  const result = await getDb().execute(
    "SELECT id, date, duration_min, session_type, created_at FROM meditation_sessions WHERE date >= date('now', '-365 days') ORDER BY date ASC, id ASC",
  );

  return jsonOk(result.rows);
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  const parsed = parseSessionInput(body);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  await ensureTable();
  const { date, duration_min, session_type } = parsed.value;

  const result = await getDb().execute({
    sql: `INSERT INTO meditation_sessions (date, duration_min, session_type, created_at) VALUES (?, ?, ?, datetime('now'))`,
    args: [date, duration_min, session_type],
  });

  return jsonOk({ ok: true, id: Number(result.lastInsertRowid) }, 201);
};

export const DELETE: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  const parsed = parseDeleteId(url.searchParams.get("id"));
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  await ensureTable();
  await getDb().execute({
    sql: "DELETE FROM meditation_sessions WHERE id = ?",
    args: [parsed.value],
  });

  return jsonOk({ ok: true });
};
