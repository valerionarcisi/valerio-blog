import { describe, test, expect } from "vitest";
import { isSpam } from "~/lib/spam-filter";

describe("isSpam", () => {
  test("clean legitimate comment passes", () => {
    expect(isSpam("Bel post, complimenti!", "Mario")).toBe(false);
  });

  test("comment with one URL passes", () => {
    expect(
      isSpam("Trovi anche un'analisi qui https://example.com/x", "Anna"),
    ).toBe(false);
  });

  test("comment with two URLs passes", () => {
    expect(
      isSpam(
        "Approfondimenti: https://a.com/x e https://b.org/y",
        "Anna",
      ),
    ).toBe(false);
  });

  test("comment with three URLs is spam", () => {
    expect(
      isSpam("https://a.com https://b.com https://c.com extra", "Bot"),
    ).toBe(true);
  });

  test("viagra keyword flagged", () => {
    expect(isSpam("buy viagra cheap online", "Pharma")).toBe(true);
  });

  test("casino keyword flagged", () => {
    expect(isSpam("Try the best online casino games", "Player")).toBe(true);
  });

  test("crypto giveaway flagged", () => {
    expect(isSpam("Free crypto giveaway, claim now", "Elon")).toBe(true);
  });

  test("SEO service spam flagged", () => {
    expect(
      isSpam("Cheap backlinks SEO service available", "Marketing"),
    ).toBe(true);
  });

  test("name contains spam keyword still flagged", () => {
    expect(isSpam("ciao!", "viagra-online")).toBe(true);
  });

  test(".ru TLD link flagged", () => {
    expect(isSpam("Look at https://shady.ru/path", "Spammer")).toBe(true);
  });

  test(".xyz TLD link flagged", () => {
    expect(isSpam("https://lol.xyz/", "Spammer")).toBe(true);
  });

  test("normal .com is not flagged", () => {
    expect(isSpam("Vedi https://example.com", "Anna")).toBe(false);
  });

  test("Italian comment with no URLs passes", () => {
    expect(
      isSpam(
        "Ho letto tutto d'un fiato. Pezzo che colpisce nel segno.",
        "Alessandra",
      ),
    ).toBe(false);
  });

  test("empty inputs return false", () => {
    expect(isSpam("", "")).toBe(false);
  });
});
