import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { verifyBearerToken } from "~/lib/auth";

export const prerender = false;

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

export const POST: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, import.meta.env.ADMIN_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { hash?: string; hashes?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const db = getDb();

  if (body.hashes && Array.isArray(body.hashes)) {
    const valid = body.hashes.filter(
      (h) => typeof h === "string" && h.length > 0 && h.length <= 32,
    );
    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: "No valid hashes" }), {
        status: 400,
      });
    }
    const placeholders = valid.map(() => "(?)").join(",");
    await db.execute({
      sql: `INSERT OR IGNORE INTO bot_hashes (hash) VALUES ${placeholders}`,
      args: valid,
    });
    await recalcUniqueForHashes(db, valid);
    return new Response(JSON.stringify({ ok: true, flagged: valid.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hash = body.hash;
  if (!hash || typeof hash !== "string" || hash.length > 32) {
    return new Response(JSON.stringify({ error: "Invalid hash" }), {
      status: 400,
    });
  }

  await db.execute({
    sql: "INSERT OR IGNORE INTO bot_hashes (hash) VALUES (?)",
    args: [hash],
  });
  await recalcUniqueForHashes(db, [hash]);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
