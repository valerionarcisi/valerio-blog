import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { generateStableVisitorHash } from "~/lib/analytics";
import {
  jsonOk,
  jsonErr,
  parseJsonBody,
  isNonEmptyString,
} from "~/lib/result";

export const prerender = false;

const MAX_CLAPS_PER_VISITOR = 50;

function clientHash(request: Request): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  const host = new URL(request.url).hostname;
  return generateStableVisitorHash(host, ip, ua);
}

async function loadCounts(
  postId: string,
  visitorHash: string,
): Promise<{ total: number; mine: number }> {
  const db = getDb();
  const totalRes = await db.execute({
    sql: "SELECT COALESCE(SUM(count), 0) AS total FROM post_claps WHERE post_id = ?",
    args: [postId],
  });
  const mineRes = await db.execute({
    sql: "SELECT COALESCE(count, 0) AS mine FROM post_claps WHERE post_id = ? AND visitor_hash = ?",
    args: [postId, visitorHash],
  });
  return {
    total: Number(totalRes.rows[0].total) || 0,
    mine:
      mineRes.rows.length > 0 ? Number(mineRes.rows[0].mine) || 0 : 0,
  };
}

export const GET: APIRoute = async ({ url, request }) => {
  const postId = url.searchParams.get("postId");
  if (!postId) return jsonErr("postId required", 400);

  const visitorHash = await clientHash(request);
  const counts = await loadCounts(postId, visitorHash);
  return jsonOk({ ...counts, max: MAX_CLAPS_PER_VISITOR });
};

export const POST: APIRoute = async ({ request }) => {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const body = bodyResult.value as Record<string, unknown> | null;
  const postId = body?.postId;
  if (!isNonEmptyString(postId)) return jsonErr("postId required", 400);

  const visitorHash = await clientHash(request);
  const db = getDb();

  const existing = await db.execute({
    sql: "SELECT count FROM post_claps WHERE post_id = ? AND visitor_hash = ?",
    args: [postId, visitorHash],
  });

  if (existing.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO post_claps (post_id, visitor_hash, count) VALUES (?, ?, 1)",
      args: [postId, visitorHash],
    });
  } else {
    const current = Number(existing.rows[0].count) || 0;
    if (current >= MAX_CLAPS_PER_VISITOR) {
      const counts = await loadCounts(postId, visitorHash);
      return jsonOk({ ...counts, max: MAX_CLAPS_PER_VISITOR, capped: true });
    }
    await db.execute({
      sql: "UPDATE post_claps SET count = count + 1, updated_at = datetime('now') WHERE post_id = ? AND visitor_hash = ?",
      args: [postId, visitorHash],
    });
  }

  const counts = await loadCounts(postId, visitorHash);
  return jsonOk({ ...counts, max: MAX_CLAPS_PER_VISITOR });
};
