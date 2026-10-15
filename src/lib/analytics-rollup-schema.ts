/**
 * Daily rollup tables (Analytics v2 / phase 3). Idempotent DDL, shared by the
 * migration script and by the rollup job (which re-ensures it, so a deploy that
 * runs before the migration does not fail).
 *
 * scope: 'human'  = verdict human;
 *        'all'    = human + unverified (everything except bots).
 * Averages are NEVER stored: keep sums + counts and divide at read time.
 * A day with zero rows has NO rows in daily_* (only a rollup_log entry).
 */
export const ROLLUP_DDL = `
  CREATE TABLE IF NOT EXISTS daily_stats (
    day        TEXT NOT NULL,
    scope      TEXT NOT NULL,
    pageviews  INTEGER NOT NULL DEFAULT 0,
    visitors   INTEGER NOT NULL DEFAULT 0,
    bounced    INTEGER NOT NULL DEFAULT 0,
    sum_time   INTEGER NOT NULL DEFAULT 0,
    n_time     INTEGER NOT NULL DEFAULT 0,
    sum_scroll INTEGER NOT NULL DEFAULT 0,
    n_scroll   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope)
  );

  CREATE TABLE IF NOT EXISTS daily_pages (
    day           TEXT NOT NULL,
    scope         TEXT NOT NULL,
    pathname      TEXT NOT NULL,
    pageviews     INTEGER NOT NULL DEFAULT 0,
    visitors      INTEGER NOT NULL DEFAULT 0,
    sum_time      INTEGER NOT NULL DEFAULT 0,
    n_time        INTEGER NOT NULL DEFAULT 0,
    sum_scroll    INTEGER NOT NULL DEFAULT 0,
    n_scroll      INTEGER NOT NULL DEFAULT 0,
    tp_visitors   INTEGER NOT NULL DEFAULT 0,
    tp_sum_scroll INTEGER NOT NULL DEFAULT 0,
    tp_n_scroll   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, pathname)
  );

  CREATE TABLE IF NOT EXISTS daily_dims (
    day       TEXT NOT NULL,
    scope     TEXT NOT NULL,
    dim       TEXT NOT NULL,
    value     TEXT NOT NULL,
    pageviews INTEGER NOT NULL DEFAULT 0,
    visitors  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, dim, value)
  );

  CREATE TABLE IF NOT EXISTS rollup_log (
    day         TEXT PRIMARY KEY,
    computed_at TEXT NOT NULL,
    rows_in     INTEGER NOT NULL DEFAULT 0
  );
`;
