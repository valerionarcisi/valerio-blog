import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { notifyNewComment } from "~/lib/email";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const pageId = url.searchParams.get("pageId");
  if (!pageId) {
    return new Response(JSON.stringify({ error: "pageId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await getDb().execute({
    sql: "SELECT id, name, text, created_at FROM comments WHERE page_id = ? AND approved = 1 ORDER BY created_at ASC",
    args: [pageId],
  });

  return new Response(JSON.stringify(result.rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { pageId, name, email, text, website } = body;

  if (website) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!pageId || !name?.trim() || !email?.trim() || !text?.trim()) {
    return new Response(JSON.stringify({ error: "All fields are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (name.length > 100 || email.length > 254 || text.length > 5000) {
    return new Response(JSON.stringify({ error: "Field too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await getDb().execute({
    sql: "INSERT INTO comments (page_id, name, email, text) VALUES (?, ?, ?, ?)",
    args: [pageId, name.trim(), email.trim(), text.trim()],
  });

  notifyNewComment({ pageId, name: name.trim(), email: email.trim(), text: text.trim() });

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
