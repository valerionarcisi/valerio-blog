import type { Client } from "@libsql/client";

const ready = new WeakSet<Client>();

async function ensureTable(db: Client): Promise<void> {
  if (ready.has(db)) return;
  await db.execute(
    "CREATE TABLE IF NOT EXISTS telegram_updates (update_id INTEGER PRIMARY KEY, seen_at TEXT)",
  );
  ready.add(db); // only after success
}

/** Returns true if the update was newly claimed, false if already seen. */
export async function claimUpdate(db: Client, updateId: number): Promise<boolean> {
  await ensureTable(db);
  const res = await db.execute({
    sql: "INSERT OR IGNORE INTO telegram_updates (update_id, seen_at) VALUES (?, ?)",
    args: [updateId, new Date().toISOString()],
  });
  return res.rowsAffected > 0;
}
