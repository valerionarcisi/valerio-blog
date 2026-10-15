import { describe, test, expect } from "vitest";
import {
  endOfUtcDay,
  escapeLike,
  evaluateRules,
  parseRuleInput,
  previewClause,
  type BotRule,
} from "./bot-rules";

const NOW = new Date("2026-10-15T12:00:00Z");
const rule = (over: Partial<BotRule>): BotRule => ({
  id: 1,
  kind: "ua_contains",
  value: "badbot",
  enabled: 1,
  expires_at: null,
  ...over,
});
const ctx = {
  ua: "Mozilla/5.0 BadBot/2.0",
  referrerHost: "spam.example.com",
  pathname: "/Blog/Ciao",
  visitorHash: "abcdef0123456789",
  now: NOW,
};

describe("evaluateRules", () => {
  test("ua_contains is a case-insensitive substring match", () => {
    expect(evaluateRules([rule({ value: "BADBOT" })], ctx)?.id).toBe(1);
    expect(evaluateRules([rule({ value: "goodbot" })], ctx)).toBeNull();
  });
  test("referrer_host matches the whole host, case-insensitively", () => {
    const r = rule({ kind: "referrer_host", value: "Spam.Example.com" });
    expect(evaluateRules([r], ctx)).not.toBeNull();
    expect(
      evaluateRules(
        [rule({ kind: "referrer_host", value: "example.com" })],
        ctx,
      ),
    ).toBeNull();
  });
  test("path_prefix matches the start of the path, case-insensitively", () => {
    expect(
      evaluateRules([rule({ kind: "path_prefix", value: "/blog/" })], ctx),
    ).not.toBeNull();
    expect(
      evaluateRules([rule({ kind: "path_prefix", value: "/ciao" })], ctx),
    ).toBeNull();
  });
  test("hash_today matches the exact visitor hash", () => {
    const r = rule({ kind: "hash_today", value: "ABCDEF0123456789" });
    expect(evaluateRules([r], ctx)).not.toBeNull();
    expect(
      evaluateRules(
        [rule({ kind: "hash_today", value: "abcdef0123456780" })],
        ctx,
      ),
    ).toBeNull();
  });
  test("disabled rules are ignored", () => {
    expect(evaluateRules([rule({ enabled: 0 })], ctx)).toBeNull();
  });
  test("expired rules are ignored, future ones apply", () => {
    expect(
      evaluateRules([rule({ expires_at: "2026-10-15 11:59:59" })], ctx),
    ).toBeNull();
    expect(
      evaluateRules([rule({ expires_at: "2026-10-16 00:00:00" })], ctx),
    ).not.toBeNull();
  });
  test("returns the first matching rule; empty values never match", () => {
    const rs = [
      rule({ id: 7, value: "nomatch" }),
      rule({ id: 8 }),
      rule({ id: 9 }),
    ];
    expect(evaluateRules(rs, ctx)?.id).toBe(8);
    expect(evaluateRules([rule({ value: "" })], ctx)).toBeNull();
  });
  test("missing context fields do not match", () => {
    expect(
      evaluateRules([rule({ kind: "referrer_host", value: "x.com" })], {
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe("endOfUtcDay", () => {
  test("is the next midnight UTC", () => {
    expect(endOfUtcDay(NOW)).toBe("2026-10-16 00:00:00");
    expect(endOfUtcDay(new Date("2026-12-31T23:59:59Z"))).toBe(
      "2027-01-01 00:00:00",
    );
  });
});

describe("parseRuleInput", () => {
  const bad = (b: unknown) => expect(parseRuleInput(b).ok).toBe(false);

  test("rejects unknown kind, empty or oversized values", () => {
    bad(null);
    bad({ kind: "country_device", value: "IT" });
    bad({ kind: "ua_contains", value: "   " });
    bad({ kind: "ua_contains", value: "x".repeat(201) });
    bad({ kind: "ua_contains", value: "bad\u0000bot" });
  });
  test("ua_contains needs at least 4 characters", () => {
    bad({ kind: "ua_contains", value: "bot" });
    expect(
      parseRuleInput({ kind: "ua_contains", value: " HeadlessChrome " }),
    ).toMatchObject({ ok: true, value: "HeadlessChrome" });
  });
  test("path_prefix must start with / and not be /", () => {
    bad({ kind: "path_prefix", value: "/" });
    bad({ kind: "path_prefix", value: "wp-admin" });
    expect(parseRuleInput({ kind: "path_prefix", value: "/wp-admin" }).ok).toBe(
      true,
    );
  });
  test("referrer_host must be a hostname and not our own", () => {
    bad({ kind: "referrer_host", value: "https://spam.com/x" });
    bad({ kind: "referrer_host", value: "valerionarcisi.me" });
    expect(
      parseRuleInput({ kind: "referrer_host", value: "Spam.COM" }),
    ).toMatchObject({ ok: true, value: "spam.com" });
  });
  test("hash_today needs a 16-char hex hash", () => {
    bad({ kind: "hash_today", value: "nothex" });
    expect(
      parseRuleInput({
        kind: "hash_today",
        value: "ABCDEF0123456789",
        note: " n ",
      }),
    ).toMatchObject({ ok: true, value: "abcdef0123456789", note: "n" });
  });
});

describe("previewClause", () => {
  test("escapes LIKE wildcards; ua_contains has no clause", () => {
    expect(escapeLike("/a_b%c\\")).toBe("/a\\_b\\%c\\\\");
    expect(previewClause("path_prefix", "/A_b")?.args).toEqual(["/a\\_b%"]);
    expect(previewClause("ua_contains", "headless")).toBeNull();
  });
});
