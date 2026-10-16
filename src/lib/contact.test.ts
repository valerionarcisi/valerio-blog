import { describe, test, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import {
  CHALLENGE_TTL_SEC,
  POW_BITS,
  claimChallenge,
  headerSafe,
  leadingZeroBits,
  makeChallenge,
  parseContactInput,
  resetContactCache,
  solveChallenge,
  verifyChallenge,
} from "./contact";

const good = {
  name: "Anna Rossi",
  email: "anna@example.com",
  message: "Ciao Valerio, vorrei parlarti di una sceneggiatura.",
};

describe("parseContactInput", () => {
  test("accepts a normal message and normalises it", () => {
    const r = parseContactInput({ ...good, name: "  Anna   Rossi ", topic: "film", lang: "en" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Anna Rossi", email: "anna@example.com", message: good.message, topic: "film", lang: "en" },
    });
  });
  test("topic and lang are optional with safe defaults", () => {
    const r = parseContactInput(good);
    expect(r.ok && r.value).toMatchObject({ topic: null, lang: "it" });
  });
  test("a filled honeypot looks like success but is dropped", () => {
    expect(parseContactInput({ ...good, website: "http://spam.example" })).toEqual({ ok: true, value: "honeypot" });
  });
  test("spam is flagged", () => {
    const r = parseContactInput({ ...good, message: "Buy cheap viagra online now, great deals here" });
    expect(r).toEqual({ ok: true, value: "spam" });
  });
  test.each([
    ["missing name", { ...good, name: "" }],
    ["control chars in the name", { ...good, name: "Anna\nBcc: evil@example.com" }],
    ["name too long", { ...good, name: "a".repeat(101) }],
    ["bad email", { ...good, email: "not-an-email" }],
    ["email with a line break", { ...good, email: "a@example.com\nBcc: x@y.z" }],
    ["message too short", { ...good, message: "ciao" }],
    ["message too long", { ...good, message: "a".repeat(5001) }],
    ["unknown topic", { ...good, topic: "hack" }],
    ["message not a string", { ...good, message: 42 }],
  ])("rejects %s", (_label, body) => {
    expect(parseContactInput(body).ok).toBe(false);
  });
  test("non-objects are rejected", () => {
    expect(parseContactInput(null).ok).toBe(false);
    expect(parseContactInput("x").ok).toBe(false);
  });
});

describe("headerSafe", () => {
  test("removes anything that could start a new header line", () => {
    expect(headerSafe("Anna\r\nBcc: evil@example.com")).toBe("Anna Bcc: evil@example.com");
    expect(headerSafe("a b")).toBe("a b");
  });
  test("bounds the length", () => {
    expect(headerSafe("x".repeat(500), 20)).toHaveLength(20);
  });
});

describe("proof of work challenge", () => {
  const secret = "s3cret";
  const now = 1_800_000_000_000;

  test("a solved challenge verifies and returns its id", () => {
    const c = makeChallenge(secret, now);
    const nonce = solveChallenge(c);
    const r = verifyChallenge(secret, c, nonce, now + 1000);
    expect(r.ok && r.value.id).toBe(c.split(".")[0]);
  });
  test("a wrong nonce fails the proof of work", () => {
    const c = makeChallenge(secret, now);
    const solved = solveChallenge(c);
    // find a nonce that is NOT a solution
    let bad = "0";
    for (let i = 0; i < 50 && bad === solved; i++) bad = `zz${i}`;
    const r = verifyChallenge(secret, c, bad, now);
    expect(r.ok === false || bad === solved).toBe(true);
    expect(leadingZeroBits(Uint8Array.from([0b00010000]))).toBe(3);
  });
  test("an expired challenge is refused", () => {
    const c = makeChallenge(secret, now);
    const r = verifyChallenge(secret, c, solveChallenge(c), now + (CHALLENGE_TTL_SEC + 5) * 1000);
    expect(r).toEqual({ ok: false, error: "Challenge expired" });
  });
  test("a tampered challenge or another secret is refused", () => {
    const c = makeChallenge(secret, now);
    const [id, exp, sig] = c.split(".");
    expect(verifyChallenge(secret, `${id}.${Number(exp) + 99999}.${sig}`, "1", now).ok).toBe(false);
    expect(verifyChallenge("other", c, solveChallenge(c), now).ok).toBe(false);
  });
  test("garbage inputs are refused, an empty secret fails closed", () => {
    expect(verifyChallenge(secret, undefined, "1").ok).toBe(false);
    expect(verifyChallenge(secret, "a.b", "1").ok).toBe(false);
    expect(verifyChallenge(secret, makeChallenge(secret, now), "not valid!").ok).toBe(false);
    expect(verifyChallenge("", "x.y.z", "1").ok).toBe(false);
    expect(() => makeChallenge("")).toThrow();
  });
  test(`difficulty is ${POW_BITS} bits: a random nonce almost never passes`, () => {
    const c = makeChallenge(secret, now);
    let passes = 0;
    for (let i = 0; i < 200; i++) if (verifyChallenge(secret, c, `n${i}`, now).ok) passes++;
    expect(passes).toBeLessThan(5);
  });
});

describe("claimChallenge", () => {
  let db: Client;
  beforeEach(() => {
    db = createClient({ url: ":memory:" });
    resetContactCache();
  });
  test("a challenge can be used once", async () => {
    expect(await claimChallenge(db, "abc")).toBe(true);
    expect(await claimChallenge(db, "abc")).toBe(false);
    expect(await claimChallenge(db, "def")).toBe(true);
  });
  test("a database failure never blocks a real visitor (fails open)", async () => {
    const broken = { execute: () => Promise.reject(new Error("down")) } as unknown as Client;
    expect(await claimChallenge(broken, "abc")).toBe(true);
  });
});
