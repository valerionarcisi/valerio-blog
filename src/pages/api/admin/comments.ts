import type { APIRoute } from "astro";
import getDb from "~/lib/turso";

export const prerender = false;

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === import.meta.env.COMMENTS_ADMIN_TOKEN;
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const status = url.searchParams.get("status") ?? "pending";
  const approvedValue = status === "approved" ? 1 : 0;

  const result = await getDb().execute({
    sql: "SELECT id, page_id, name, email, text, approved, created_at FROM comments WHERE approved = ? ORDER BY created_at DESC",
    args: [approvedValue],
  });

  return new Response(JSON.stringify(result.rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id, action } = await request.json();

  if (action === "approve") {
    await getDb().execute({
      sql: "UPDATE comments SET approved = 1 WHERE id = ?",
      args: [id],
    });
  } else if (action === "delete") {
    await getDb().execute({
      sql: "DELETE FROM comments WHERE id = ?",
      args: [id],
    });
  } else {
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
