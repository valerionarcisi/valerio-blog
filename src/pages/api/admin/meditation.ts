import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import getDb from "~/lib/turso";

function isAuthorized(request: Request): boolean {
  return verifyBearerToken(request, import.meta.env.ADMIN_TOKEN);
}

async function ensureTable() {
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
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureTable();

  const result = await getDb().execute(
    "SELECT id, date, duration_min, session_type, created_at FROM meditation_sessions WHERE date >= date('now', '-365 days') ORDER BY date ASC, id ASC",
  );

  return new Response(JSON.stringify(result.rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { date, duration_min, session_type } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(
      JSON.stringify({ error: "Valid date (YYYY-MM-DD) required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await ensureTable();

  const result = await getDb().execute({
    sql: `INSERT INTO meditation_sessions (date, duration_min, session_type, created_at) VALUES (?, ?, ?, datetime('now'))`,
    args: [date, duration_min ?? 0, session_type ?? null],
  });

  return new Response(
    JSON.stringify({ ok: true, id: Number(result.lastInsertRowid) }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
};

export const DELETE: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(
      JSON.stringify({ error: "id param required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await ensureTable();

  await getDb().execute({
    sql: "DELETE FROM meditation_sessions WHERE id = ?",
    args: [Number(id)],
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
