import { describe, test, expect } from "vitest";
import { createClient } from "@libsql/client";
import type { Client } from "@libsql/client";
import { checkRate, rateKey } from "./rate-limit";

describe("checkRate", () => {
  test("allows up to limit then blocks, new window resets", async () => {
    const db = createClient({ url: ":memory:" });
    const t = 1_000_000_000_000;
    for (let i = 0; i < 3; i++) expect(await checkRate(db, "k", 3, 60, t)).toBe(true);
    expect(await checkRate(db, "k", 3, 60, t)).toBe(false);
    expect(await checkRate(db, "other", 3, 60, t)).toBe(true);
    expect(await checkRate(db, "k", 3, 60, t + 61_000)).toBe(true);
  });

  test("fails open on DB error", async () => {
    const db = { execute: async () => { throw new Error("down"); } } as unknown as Client;
    expect(await checkRate(db, "k", 1, 60)).toBe(true);
    expect(await checkRate(db, "k", 1, 60)).toBe(true);
  });

  test("rateKey prefers netlify header and differs per route", () => {
    const r = new Request("https://x/", {
      headers: { "x-nf-client-connection-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" },
    });
    expect(rateKey(r, "a")).not.toBe(rateKey(r, "b"));
    const r2 = new Request("https://x/", { headers: { "x-nf-client-connection-ip": "1.1.1.1" } });
    expect(rateKey(r, "a")).toBe(rateKey(r2, "a"));
  });
});
