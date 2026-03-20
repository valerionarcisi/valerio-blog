import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import getDb from "~/lib/turso";

function isAuthorized(request: Request): boolean {
  return verifyBearerToken(request, import.meta.env.ADMIN_TOKEN);
}

async function ensureTable() {
  await getDb().execute(`
    CREATE TABLE IF NOT EXISTS meditation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      duration_min INTEGER DEFAULT 0,
      session_type TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureTable();

  const result = await getDb().execute(
    "SELECT date, duration_min, session_type, note FROM meditation_log WHERE date >= date('now', '-365 days') ORDER BY date ASC",
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
  const { date, duration_min, session_type, note } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(
      JSON.stringify({ error: "Valid date (YYYY-MM-DD) required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await ensureTable();

  await getDb().execute({
    sql: `INSERT INTO meditation_log (date, duration_min, session_type, note)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET
            duration_min = excluded.duration_min,
            session_type = excluded.session_type,
            note = excluded.note`,
    args: [
      date,
      duration_min ?? 0,
      session_type ?? null,
      note?.trim() || null,
    ],
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date = url.searchParams.get("date");
  if (!date) {
    return new Response(
      JSON.stringify({ error: "date param required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  await ensureTable();

  await getDb().execute({
    sql: "DELETE FROM meditation_log WHERE date = ?",
    args: [date],
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
