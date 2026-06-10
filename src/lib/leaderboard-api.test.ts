import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { parseNewScore, submitScore, topScores } from "~/lib/leaderboard-api";

let db: Client;

beforeEach(() => {
  db = createClient({ url: ":memory:" });
});

describe("parseNewScore", () => {
  test("accepts a valid score and trims the name", () => {
    const r = parseNewScore({ name: "  Filippo  ", score: 120 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Filippo");
      expect(r.value.score).toBe(120);
    }
  });

  test("coerces numeric strings", () => {
    const r = parseNewScore({ name: "Tea", score: "200" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.score).toBe(200);
  });

  test("falls back to Anonimo for empty names", () => {
    const r = parseNewScore({ name: "   ", score: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Anonimo");
  });

  test("strips control characters from the name", () => {
    const r = parseNewScore({ name: "Giulio", score: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Giulio");
  });

  test("clamps name length to 24 chars", () => {
    const r = parseNewScore({ name: "x".repeat(50), score: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name.length).toBe(24);
  });

  test("rejects negative scores", () => {
    expect(parseNewScore({ name: "x", score: -1 }).ok).toBe(false);
  });

  test("rejects non-integer scores", () => {
    expect(parseNewScore({ name: "x", score: 1.5 }).ok).toBe(false);
  });

  test("rejects non-numeric scores", () => {
    expect(parseNewScore({ name: "x", score: "abc" }).ok).toBe(false);
  });

  test("rejects implausibly large scores (anti-cheat)", () => {
    expect(parseNewScore({ name: "x", score: 9_999_999 }).ok).toBe(false);
  });
});

describe("submitScore + topScores", () => {
  test("returns scores ordered descending", async () => {
    await submitScore(db, { name: "A", score: 50 }, "h1");
    await submitScore(db, { name: "B", score: 200 }, "h2");
    await submitScore(db, { name: "C", score: 100 }, "h3");

    const top = await topScores(db);
    expect(top.map((s) => s.name)).toEqual(["B", "C", "A"]);
    expect(top[0].score).toBe(200);
  });

  test("keeps only the best score per name", async () => {
    await submitScore(db, { name: "Filippo", score: 80 }, "h1");
    await submitScore(db, { name: "Filippo", score: 300 }, "h1");
    await submitScore(db, { name: "Filippo", score: 150 }, "h1");

    const top = await topScores(db);
    const filippo = top.filter((s) => s.name === "Filippo");
    expect(filippo).toHaveLength(1);
    expect(filippo[0].score).toBe(300);
  });

  test("limits results", async () => {
    for (let i = 0; i < 15; i++) {
      await submitScore(db, { name: `P${i}`, score: i * 10 }, `h${i}`);
    }
    const top = await topScores(db, 10);
    expect(top).toHaveLength(10);
    expect(top[0].score).toBe(140);
  });

  test("returns an empty array with no scores", async () => {
    expect(await topScores(db)).toEqual([]);
  });
});
