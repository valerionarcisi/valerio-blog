import { describe, test, expect, vi } from "vitest";
import type { Client } from "@libsql/client";
import { claimUpdate } from "./telegram-dedup";

function mockDb(results: Array<{ rowsAffected: number } | Error>) {
  const execute = vi.fn(async (q: unknown) => {
    const sql = typeof q === "string" ? q : (q as { sql: string }).sql;
    if (sql.startsWith("CREATE")) {
      const r = results.shift();
      if (r instanceof Error) throw r;
      return { rowsAffected: 0 };
    }
    const r = results.shift()!;
    if (r instanceof Error) throw r;
    return r;
  });
  return { db: { execute } as unknown as Client, execute };
}

describe("claimUpdate", () => {
  test("true when inserted, false when ignored; table created once", async () => {
    const { db, execute } = mockDb([
      { rowsAffected: 0 }, // create
      { rowsAffected: 1 },
      { rowsAffected: 0 },
    ]);
    expect(await claimUpdate(db, 1)).toBe(true);
    expect(await claimUpdate(db, 1)).toBe(false);
    const creates = execute.mock.calls.filter((c) => String(c[0]).startsWith("CREATE"));
    expect(creates).toHaveLength(1);
  });

  test("CREATE failure is not memoised", async () => {
    const { db, execute } = mockDb([
      new Error("boom"),
      { rowsAffected: 0 }, // create retry
      { rowsAffected: 1 },
    ]);
    await expect(claimUpdate(db, 5)).rejects.toThrow("boom");
    expect(await claimUpdate(db, 5)).toBe(true);
    const creates = execute.mock.calls.filter((c) => String(c[0]).startsWith("CREATE"));
    expect(creates).toHaveLength(2);
  });
});
