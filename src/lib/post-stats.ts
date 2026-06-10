import getDb from "~/lib/turso";

export interface PostStats {
  claps: Record<string, number>;
  comments: Record<string, number>;
}

/**
 * Returns clap totals + approved-comment counts for every blog post.
 * Keyed by slug (no `blog/` prefix). Returns empty maps if DB is unreachable.
 *
 * Called at build/SSR time from the home page to enrich the blog cards.
 */
export async function fetchPostStats(): Promise<PostStats> {
  try {
    const db = getDb();
    const [clapsRes, commentsRes] = await Promise.all([
      db.execute(
        `SELECT post_id, SUM(count) AS total
         FROM post_claps
         GROUP BY post_id`,
      ),
      db.execute(
        `SELECT page_id, COUNT(*) AS total
         FROM comments
         WHERE approved = 1
         GROUP BY page_id`,
      ),
    ]);

    const claps: Record<string, number> = {};
    for (const row of clapsRes.rows) {
      const id = String(row.post_id ?? "");
      const slug = id.replace(/^blog\//, "").replace(/^en\/blog\//, "");
      if (slug) claps[slug] = Number(row.total ?? 0);
    }

    const comments: Record<string, number> = {};
    for (const row of commentsRes.rows) {
      const id = String(row.page_id ?? "");
      const slug = id.replace(/^blog\//, "").replace(/^en\/blog\//, "");
      if (slug) comments[slug] = Number(row.total ?? 0);
    }

    return { claps, comments };
  } catch (err) {
    console.error("[post-stats] DB unreachable:", err);
    return { claps: {}, comments: {} };
  }
}

/**
 * Clap totals for film reviews, keyed by film slug (the `review:` prefix stripped).
 * Used by the home page "ultima recensione" widget. Empty map if DB is unreachable.
 */
export async function fetchReviewClaps(): Promise<Record<string, number>> {
  try {
    const db = getDb();
    const res = await db.execute(
      `SELECT post_id, SUM(count) AS total
       FROM post_claps
       WHERE post_id LIKE 'review:%'
       GROUP BY post_id`,
    );
    const claps: Record<string, number> = {};
    for (const row of res.rows) {
      const slug = String(row.post_id ?? "").replace(/^review:/, "");
      if (slug) claps[slug] = Number(row.total ?? 0);
    }
    return claps;
  } catch (err) {
    console.error("[post-stats] review claps DB unreachable:", err);
    return {};
  }
}
