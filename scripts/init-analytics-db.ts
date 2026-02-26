import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

await db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS pageviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id         TEXT NOT NULL,
    hostname        TEXT NOT NULL,
    pathname        TEXT NOT NULL,
    referrer        TEXT,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    utm_content     TEXT,
    is_unique       INTEGER NOT NULL DEFAULT 0,
    time_on_page    INTEGER,
    scroll_depth    INTEGER,
    browser         TEXT,
    os              TEXT,
    device_type     TEXT,
    screen_width    INTEGER,
    screen_height   INTEGER,
    viewport_width  INTEGER,
    viewport_height INTEGER,
    language        TEXT,
    country         TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pv_created ON pageviews(created_at);
  CREATE INDEX IF NOT EXISTS idx_pv_pathname ON pageviews(pathname);
  CREATE INDEX IF NOT EXISTS idx_pv_hostname ON pageviews(hostname, created_at);
  CREATE INDEX IF NOT EXISTS idx_pv_page_id ON pageviews(page_id);
`);

console.log("Analytics table created successfully.");
