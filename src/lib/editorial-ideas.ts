import getDb from "~/lib/turso";

export type IdeaSource = "manual" | "voice" | "forward" | "analyst-suggested";
export type IdeaStatus = "idea" | "drafting" | "scheduled" | "published" | "archived";

export interface Idea {
  id: number;
  text: string;
  source: IdeaSource;
  column: string | null;
  status: IdeaStatus;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string | null;
}

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS editorial_ideas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  text          TEXT NOT NULL,
  source        TEXT NOT NULL,
  "column"      TEXT,
  status        TEXT NOT NULL DEFAULT 'idea',
  scheduled_for TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_editorial_ideas_status ON editorial_ideas(status);
CREATE INDEX IF NOT EXISTS idx_editorial_ideas_created_at ON editorial_ideas(created_at DESC);
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

export async function createIdea(input: {
  text: string;
  source: IdeaSource;
  column?: string | null;
}): Promise<number> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "INSERT INTO editorial_ideas (text, source, \"column\") VALUES (?, ?, ?) RETURNING id",
    args: [input.text, input.source, input.column ?? null],
  });
  return Number(r.rows[0].id);
}

export async function listIdeas(status: IdeaStatus = "idea", limit = 20): Promise<Idea[]> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM editorial_ideas WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    args: [status, limit],
  });
  return r.rows as unknown as Idea[];
}

export async function getIdea(id: number): Promise<Idea | null> {
  await ensureTable();
  const r = await getDb().execute({
    sql: "SELECT * FROM editorial_ideas WHERE id = ?",
    args: [id],
  });
  return (r.rows[0] as unknown as Idea) ?? null;
}

export async function markIdeaStatus(id: number, status: IdeaStatus): Promise<void> {
  await ensureTable();
  await getDb().execute({
    sql: "UPDATE editorial_ideas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [status, id],
  });
}
