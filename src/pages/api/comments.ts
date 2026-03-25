import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { notifyNewComment } from "~/lib/email";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  isNonEmptyString,
  isValidEmail,
} from "~/lib/result";

export const prerender = false;

interface CommentInput {
  pageId: string;
  name: string;
  email: string;
  text: string;
}

function parseCommentInput(body: unknown): Result<CommentInput | "honeypot"> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const { pageId, name, email, text, website } = body as Record<
    string,
    unknown
  >;

  if (website) return ok("honeypot" as const);

  if (!isNonEmptyString(pageId)) return err("pageId required");
  if (!isNonEmptyString(name) || name.length > 100) return err("Invalid name");
  if (!isValidEmail(email)) return err("Invalid email");
  if (!isNonEmptyString(text) || text.length > 5000)
    return err("Text too long");

  return ok({
    pageId: pageId.trim(),
    name: name.trim(),
    email: email.trim(),
    text: text.trim(),
  });
}

export const GET: APIRoute = async ({ url }) => {
  const pageId = url.searchParams.get("pageId");
  if (!pageId) return jsonErr("pageId required", 400);

  const result = await getDb().execute({
    sql: "SELECT id, name, text, created_at FROM comments WHERE page_id = ? AND approved = 1 ORDER BY created_at ASC",
    args: [pageId],
  });

  return jsonOk(result.rows);
};

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const parsed = parseCommentInput(body);
  if (!parsed.ok) return jsonErr(parsed.error, 400);
  if (parsed.value === "honeypot") return jsonOk({ ok: true });

  const { pageId, name, email, text } = parsed.value;

  await getDb().execute({
    sql: "INSERT INTO comments (page_id, name, email, text) VALUES (?, ?, ?, ?)",
    args: [pageId, name, email, text],
  });

  notifyNewComment({ pageId, name, email, text });

  return jsonOk({ ok: true }, 201);
};
