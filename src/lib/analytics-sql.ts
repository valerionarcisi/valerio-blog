/**
 * SQL fragments shared by /api/stats (raw queries) and the daily rollup, so the
 * two can never drift apart.
 */

/** First path segment classification, identical for raw reads and rollups. */
export const SECTION_SQL = `CASE
                WHEN pathname = '/' OR pathname = '/en' OR pathname = '/en/' THEN 'home'
                WHEN pathname LIKE '/blog/%' OR pathname LIKE '/en/blog/%' OR pathname = '/blog' OR pathname = '/en/blog' THEN 'blog'
                WHEN pathname LIKE '/films/%' OR pathname LIKE '/en/films/%' OR pathname = '/films' OR pathname = '/en/films' THEN 'films'
                WHEN pathname LIKE '/tag/%' OR pathname LIKE '/en/tag/%' THEN 'tag'
                WHEN pathname LIKE '/chi-sono%' OR pathname LIKE '/en/about%' THEN 'about'
                WHEN pathname LIKE '/visti%' OR pathname LIKE '/en/visti%' THEN 'visti'
                WHEN pathname LIKE '/musica%' OR pathname LIKE '/en/music%' THEN 'musica'
                WHEN pathname LIKE '/sport%' OR pathname LIKE '/en/sport%' THEN 'sport'
                WHEN pathname LIKE '/note%' OR pathname LIKE '/en/notes%' THEN 'note'
                ELSE 'altro'
              END`;

/** Blog posts only (used by "top engaged posts"). */
export const BLOG_PATH_SQL = `(pathname LIKE '/blog/%' OR pathname LIKE '/en/blog/%')`;
