import getDb from "~/lib/turso";

export interface TopPost {
  slug: string;
  views: number;
}

/**
 * Top blog posts ranked by pageviews in the last `days` days.
 * Returns slugs (extracted from pathname like /blog/{slug}/ or /en/blog/{slug}/).
 * Gracefully returns [] if the DB is unreachable (e.g. at build time without env).
 */
export async function getTopPosts(opts: {
  lang?: "it" | "en";
  days?: number;
  limit?: number;
} = {}): Promise<TopPost[]> {
  const { lang = "it", days = 90, limit = 5 } = opts;

  const prefix = lang === "en" ? "/en/blog/" : "/blog/";

  try {
    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.execute({
      sql: `SELECT pathname, COUNT(*) AS views
            FROM pageviews
            WHERE created_at >= ?
              AND pathname LIKE ?
            GROUP BY pathname
            ORDER BY views DESC
            LIMIT ?`,
      args: [since, `${prefix}%`, limit],
    });

    return result.rows
      .map((row) => {
        const pathname = String(row.pathname ?? "");
        const slug = pathname
          .replace(/^\/en\/blog\//, "")
          .replace(/^\/blog\//, "")
          .replace(/\/$/, "");
        if (!slug || slug.includes("/")) return null;
        return { slug, views: Number(row.views ?? 0) };
      })
      .filter((p): p is TopPost => p !== null);
  } catch (err) {
    console.error("[top-posts] DB unreachable, returning []:", err);
    return [];
  }
}
