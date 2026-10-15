import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  BOT_SQL,
  HUMAN_SQL,
  UNVERIFIED_SQL,
  VERDICT_SQL,
  verdictOf,
} from "./bot-verdict";

let db: Client;

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(`
    CREATE TABLE pageviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_hash TEXT,
      human INTEGER DEFAULT 0, bot_score INTEGER DEFAULT 0
    );
    CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY);
    INSERT INTO bot_hashes VALUES ('legacy');
    INSERT INTO pageviews (visitor_hash, human, bot_score) VALUES
      ('a', 1, 0),
      ('b', 0, 0),
      ('c', 0, 5),
      ('d', 1, 4),
      ('e', 1, 99),
      ('legacy', 1, 0),
      (NULL, 0, NULL),
      ('f', NULL, 0);
  `);
});

async function ids(where: string) {
  const r = await db.execute(
    `SELECT id FROM pageviews WHERE ${where} ORDER BY id`,
  );
  return r.rows.map((x) => Number(x.id));
}

describe("verdict SQL", () => {
  test("bot / human / unverified partition the dataset", async () => {
    // rows: 1 human, 2 unverified, 3 bot (threshold), 4 human (score 4),
    // 5 bot (rule + engage), 6 bot (legacy flag), 7/8 unverified (NULLs)
    expect(await ids(BOT_SQL)).toEqual([3, 5, 6]);
    expect(await ids(HUMAN_SQL)).toEqual([1, 4]);
    expect(await ids(UNVERIFIED_SQL)).toEqual([2, 7, 8]);
  });

  test("VERDICT_SQL labels each row and agrees with the JS twin", async () => {
    const r = await db.execute(
      `SELECT id, ${VERDICT_SQL} AS v FROM pageviews ORDER BY id`,
    );
    expect(r.rows.map((x) => x.v)).toEqual([
      "human",
      "unverified",
      "bot",
      "human",
      "bot",
      "bot",
      "unverified",
      "unverified",
    ]);
    expect(verdictOf({ human: 1, bot_score: 0 })).toBe("human");
    expect(verdictOf({ human: 1, bot_score: 5 })).toBe("bot");
    expect(verdictOf({ human: 0, bot_score: 4 })).toBe("unverified");
    expect(verdictOf({ human: 1, legacyFlagged: true })).toBe("bot");
  });
});
