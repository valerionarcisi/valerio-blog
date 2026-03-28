import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { verifyAdminBearerToken } from "~/lib/auth";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  parseJsonBody,
} from "~/lib/result";

export const prerender = false;

function isAuthorized(request: Request): boolean {
  return verifyAdminBearerToken(request);
}

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

const ACTION_SQL: Record<string, string> = {
  approve: "UPDATE comments SET approved = 1 WHERE id = ?",
  delete: "DELETE FROM comments WHERE id = ?",
};

export const GET: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  const status = url.searchParams.get("status") ?? "pending";
  const approvedValue = status === "approved" ? 1 : 0;

  const result = await getDb().execute({
    sql: "SELECT id, page_id, name, email, text, approved, created_at FROM comments WHERE approved = ? ORDER BY created_at DESC",
    args: [approvedValue],
  });

  return jsonOk(result.rows);
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) return jsonErr("Unauthorized", 401);

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseCommentAction(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);

  await getDb().execute({
    sql: ACTION_SQL[parsed.value.type],
    args: [parsed.value.id],
  });

  return jsonOk({ ok: true });
};
