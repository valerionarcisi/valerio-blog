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

  -- Phase 2. Sessions are attributed to the UTC day they STARTED.
  CREATE TABLE IF NOT EXISTS daily_sessions (
    day             TEXT NOT NULL,
    scope           TEXT NOT NULL,
    sessions        INTEGER NOT NULL DEFAULT 0,
    bounced_sessions INTEGER NOT NULL DEFAULT 0,
    pageviews       INTEGER NOT NULL DEFAULT 0,
    engaged_seconds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope)
  );

  -- prop '' = no prop (PK columns cannot be NULL). Events are attributed to the day they happened.
  CREATE TABLE IF NOT EXISTS daily_events (
    day      TEXT NOT NULL,
    scope    TEXT NOT NULL,
    name     TEXT NOT NULL,
    prop     TEXT NOT NULL DEFAULT '',
    count    INTEGER NOT NULL DEFAULT 0,
    visitors INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, name, prop)
  );

  CREATE TABLE IF NOT EXISTS daily_entry_exit (
    day      TEXT NOT NULL,
    scope    TEXT NOT NULL,
    kind     TEXT NOT NULL,
    path     TEXT NOT NULL,
    sessions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, kind, path)
  );

  -- Goal conversions (distinct sessions, by session start day). goal '_sessions' holds the
  -- session counts per channel/entry used as denominators. dim: total | channel | entry.
  CREATE TABLE IF NOT EXISTS daily_goals (
    day         TEXT NOT NULL,
    scope       TEXT NOT NULL,
    goal        TEXT NOT NULL,
    dim         TEXT NOT NULL,
    value       TEXT NOT NULL,
    conversions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, goal, dim, value)
  );

  -- Phase 5. Core Web Vitals per day: Google buckets + exact p75 of the day.
  -- device 'all' = every device. p75 / metric in storage units (ms; cls in thousandths).
  CREATE TABLE IF NOT EXISTS daily_vitals (
    day    TEXT NOT NULL,
    scope  TEXT NOT NULL,
    device TEXT NOT NULL,
    metric TEXT NOT NULL,
    n      INTEGER NOT NULL DEFAULT 0,
    good   INTEGER NOT NULL DEFAULT 0,
    ni     INTEGER NOT NULL DEFAULT 0,
    poor   INTEGER NOT NULL DEFAULT 0,
    p75    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, scope, device, metric)
  );

  CREATE TABLE IF NOT EXISTS rollup_log (
    day         TEXT PRIMARY KEY,
    computed_at TEXT NOT NULL,
    rows_in     INTEGER NOT NULL DEFAULT 0
  );
`;
