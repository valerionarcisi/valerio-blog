import { describe, test, expect, vi, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";

let db: Client;

vi.mock("~/lib/turso", () => ({
  default: () => db,
}));

import {
  ensureTable,
  createIdea,
  listIdeas,
  markIdeaStatus,
  getIdea,
  __resetEnsured,
} from "./editorial-ideas";

beforeEach(async () => {
  db = createClient({ url: ":memory:" });
  __resetEnsured();
});

describe("editorial-ideas", () => {
  test("ensureTable creates the table idempotently", async () => {
    await ensureTable();
    await ensureTable();
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='editorial_ideas'",
    );
    expect(res.rows).toHaveLength(1);
  });

  test("createIdea inserts and returns the id", async () => {
    await ensureTable();
    const id = await createIdea({ text: "Scrivere su Result Pattern", source: "manual" });
    expect(id).toBeGreaterThan(0);
  });

  test("listIdeas returns ideas with status idea by default", async () => {
    await ensureTable();
    await createIdea({ text: "uno", source: "manual" });
    await createIdea({ text: "due", source: "voice" });
    const ideas = await listIdeas();
    expect(ideas).toHaveLength(2);
    expect(ideas[0].text).toBe("due"); // most recent first
  });

  test("listIdeas can filter by status", async () => {
    await ensureTable();
    const id = await createIdea({ text: "uno", source: "manual" });
    await markIdeaStatus(id, "published");
    const open = await listIdeas("idea");
    const pub = await listIdeas("published");
    expect(open).toHaveLength(0);
    expect(pub).toHaveLength(1);
  });

  test("markIdeaStatus updates the row", async () => {
    await ensureTable();
    const id = await createIdea({ text: "x", source: "manual" });
    await markIdeaStatus(id, "drafting");
    const idea = await getIdea(id);
    expect(idea?.status).toBe("drafting");
  });
});
