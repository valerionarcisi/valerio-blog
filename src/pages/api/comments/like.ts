import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { generateStableVisitorHash } from "~/lib/analytics";
import { jsonOk, jsonErr, parseJsonBody } from "~/lib/result";

export const prerender = false;

function clientHash(request: Request): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  const host = new URL(request.url).hostname;
  return generateStableVisitorHash(host, ip, ua);
}

export const POST: APIRoute = async ({ request }) => {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const body = bodyResult.value as Record<string, unknown> | null;
  const commentId = body?.commentId;
  if (
    typeof commentId !== "number" ||
    !Number.isInteger(commentId) ||
    commentId <= 0
  ) {
    return jsonErr("Invalid commentId", 400);
  }

  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT id, approved FROM comments WHERE id = ?",
    args: [commentId],
  });
  if (existing.rows.length === 0) return jsonErr("Comment not found", 404);
  if (existing.rows[0].approved !== 1)
    return jsonErr("Cannot like a pending comment", 400);

  const visitorHash = await clientHash(request);

  const already = await db.execute({
    sql: "SELECT id FROM comment_likes WHERE comment_id = ? AND visitor_hash = ?",
    args: [commentId, visitorHash],
  });

  let liked: boolean;
  if (already.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO comment_likes (comment_id, visitor_hash) VALUES (?, ?)",
      args: [commentId, visitorHash],
    });
    liked = true;
  } else {
    await db.execute({
      sql: "DELETE FROM comment_likes WHERE comment_id = ? AND visitor_hash = ?",
      args: [commentId, visitorHash],
    });
    liked = false;
  }

  await db.execute({
    sql: "UPDATE comments SET likes_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) WHERE id = ?",
    args: [commentId, commentId],
  });

  const countRes = await db.execute({
    sql: "SELECT likes_count FROM comments WHERE id = ?",
    args: [commentId],
  });
  const count = Number(countRes.rows[0]?.likes_count ?? 0);

  return jsonOk({ liked, count });
};
