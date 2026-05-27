import getDb from "~/lib/turso";

export type MediaSource = "telegram" | "manual" | "screenshot";

export interface Media {
  id: number;
  filename: string;
  path: string;
  caption: string | null;
  tags: string | null;
  source: MediaSource;
  used_count: number;
  created_at: string;
}

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS media_library (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filename    TEXT UNIQUE NOT NULL,
  path        TEXT NOT NULL,
  caption     TEXT,
  tags        TEXT,
  source      TEXT NOT NULL,
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON media_library(created_at DESC);
`;

let ensured = false;

export function __resetEnsured(): void {
  ensured = false;
}

export async function ensureTable(): Promise<void> {
  if (ensured) return;
  await getDb().executeMultiple(TABLE_SQL);
  ensured = true;
}

export async function createMedia(input: {
  filename: string;
  path: string;
  caption?: string | null;
  source: MediaSource;
}): Promise<number> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "INSERT INTO media_library (filename, path, caption, source) VALUES (?, ?, ?, ?) RETURNING id",
    args: [input.filename, input.path, input.caption ?? null, input.source],
  });
  return Number(r.rows[0].id);
}

export async function listMedia(limit = 10): Promise<Media[]> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM media_library ORDER BY created_at DESC, id DESC LIMIT ?",
    args: [limit],
  });
  return r.rows as unknown as Media[];
}

export async function getMedia(id: number): Promise<Media | null> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM media_library WHERE id = ?",
    args: [id],
  });
  return (r.rows[0] as unknown as Media) ?? null;
}

export async function tagMedia(id: number, tags: string[]): Promise<void> {
  await ensureTable();
  const csv = tags.map((t) => t.trim().toLowerCase()).filter(Boolean).join(",");
  await getDb().execute({
    sql: "UPDATE media_library SET tags = ? WHERE id = ?",
    args: [csv, id],
  });
}

export async function deleteMedia(id: number): Promise<void> {
  await ensureTable();
  await getDb().execute({
    sql: "DELETE FROM media_library WHERE id = ?",
    args: [id],
  });
}
