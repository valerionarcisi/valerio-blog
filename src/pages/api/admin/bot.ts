import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { verifyBearerToken } from "~/lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, import.meta.env.ANALYTICS_ADMIN_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { hash?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const hash = body.hash;
  if (!hash || typeof hash !== "string" || hash.length > 32) {
    return new Response(JSON.stringify({ error: "Invalid hash" }), {
      status: 400,
    });
  }

  await getDb().execute({
    sql: "INSERT OR IGNORE INTO bot_hashes (hash) VALUES (?)",
    args: [hash],
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
