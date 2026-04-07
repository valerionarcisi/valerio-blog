import type { APIRoute } from "astro";
import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import getDb from "~/lib/turso";
import {
  notifyCommentApproved,
  notifyCommentRejected,
  notifyReplyToYourComment,
} from "~/lib/email";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  parseJsonBody,
} from "~/lib/result";

export const prerender = false;

type CommentAction =
  | { type: "approve"; id: number }
  | { type: "delete"; id: number };

function parseCommentAction(body: unknown): Result<CommentAction> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const { id, action } = body as Record<string, unknown>;

  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0)
    return err("Valid id required");

  if (action === "approve") return ok({ type: "approve", id });
  if (action === "delete") return ok({ type: "delete", id });

  return err("Invalid action — expected 'approve' or 'delete'");
}

interface CommentRow {
  id: number;
  page_id: string;
  name: string;
  email: string;
  text: string;
  parent_id: number | null;
  lang: string;
  notified_approved: number;
}

async function loadComment(id: number): Promise<CommentRow | null> {
  const res = await getDb().execute({
    sql: `SELECT id, page_id, name, email, text, parent_id, lang, notified_approved
          FROM comments WHERE id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    page_id: String(row.page_id),
    name: String(row.name),
    email: String(row.email),
    text: String(row.text),
    parent_id: row.parent_id === null ? null : Number(row.parent_id),
    lang: String(row.lang ?? "it"),
    notified_approved: Number(row.notified_approved ?? 0),
  };
}

async function loadParent(parentId: number): Promise<{
  name: string;
  email: string;
} | null> {
  const res = await getDb().execute({
    sql: "SELECT name, email FROM comments WHERE id = ?",
    args: [parentId],
  });
  if (res.rows.length === 0) return null;
  return {
    name: String(res.rows[0].name),
    email: String(res.rows[0].email),
  };
}

export const GET: APIRoute = async ({ url, request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const status = url.searchParams.get("status") ?? "pending";
  const approvedValue = status === "approved" ? 1 : 0;

  const result = await getDb().execute({
    sql: `SELECT c.id, c.page_id, c.name, c.email, c.text, c.approved, c.created_at,
            c.parent_id, c.likes_count, c.lang,
            p.name AS parent_name,
            (SELECT COUNT(*) FROM comments k WHERE k.parent_id = c.id) AS children_count
          FROM comments c
          LEFT JOIN comments p ON p.id = c.parent_id
          WHERE c.approved = ?
          ORDER BY c.created_at DESC`,
    args: [approvedValue],
  });

  return jsonOk(result.rows);
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!verifyBearerToken(request, env("ADMIN_TOKEN"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseCommentAction(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  const comment = await loadComment(parsed.value.id);
  if (!comment) return jsonErr("Comment not found", 404);

  if (parsed.value.type === "approve") {
    await getDb().execute({
      sql: "UPDATE comments SET approved = 1, notified_approved = 1 WHERE id = ?",
      args: [parsed.value.id],
    });

    if (comment.notified_approved === 0) {
      notifyCommentApproved({
        pageId: comment.page_id,
        name: comment.name,
        email: comment.email,
        text: comment.text,
        lang: comment.lang,
      });

      if (comment.parent_id !== null) {
        const parent = await loadParent(comment.parent_id);
        if (parent && parent.email !== comment.email) {
          notifyReplyToYourComment({
            pageId: comment.page_id,
            parentName: parent.name,
            parentEmail: parent.email,
            replyName: comment.name,
            replyText: comment.text,
            lang: comment.lang,
          });
        }
      }
    }
  } else {
    await getDb().execute({
      sql: "DELETE FROM comments WHERE id = ?",
      args: [parsed.value.id],
    });
    notifyCommentRejected({
      pageId: comment.page_id,
      name: comment.name,
      email: comment.email,
      lang: comment.lang,
    });
  }

  return jsonOk({ ok: true });
};
