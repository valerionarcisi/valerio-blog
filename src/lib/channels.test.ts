import { describe, test, expect } from "vitest";
import { classifyChannel } from "./channels";

const c = (
  referrerHost?: string | null,
  utmSource?: string,
  utmMedium?: string,
) => classifyChannel({ referrerHost, utmSource, utmMedium });

describe("classifyChannel", () => {
  test("no referrer, no utm -> direct", () => {
    expect(c(null)).toBe("direct");
    expect(c(undefined)).toBe("direct");
  });

  test("search engines", () => {
    for (const h of [
      "google.com",
      "www.google.it",
      "bing.com",
      "duckduckgo.com",
      "ecosia.org",
      "search.yahoo.com",
    ]) {
      expect(c(h)).toBe("search");
    }
  });

  test("social", () => {
    for (const h of [
      "facebook.com",
      "l.facebook.com",
      "t.co",
      "x.com",
      "www.linkedin.com",
      "bsky.app",
      "threads.net",
      "instagram.com",
    ]) {
      expect(c(h)).toBe("social");
    }
  });

  test("ai (before search for gemini.google.com)", () => {
    for (const h of [
      "chatgpt.com",
      "perplexity.ai",
      "claude.ai",
      "gemini.google.com",
      "copilot.microsoft.com",
    ]) {
      expect(c(h)).toBe("ai");
    }
  });

  test("email (before search for mail.google.com)", () => {
    for (const h of ["mail.google.com", "outlook.live.com", "mail.yahoo.com"]) {
      expect(c(h)).toBe("email");
    }
  });

  test("unknown referrer -> referral", () => {
    expect(c("example.org")).toBe("referral");
  });

  test("utm medium wins over referrer", () => {
    expect(c("google.com", "newsletter", "email")).toBe("email");
    expect(c(null, "x", "cpc")).toBe("campaign");
    expect(c("google.com", "x", "social")).toBe("social");
  });

  test("utm source only", () => {
    expect(c(null, "twitter")).toBe("social");
    expect(c(null, "newsletter")).toBe("email");
    expect(c(null, "launch-2026")).toBe("campaign");
  });

  test("unknown utm medium -> campaign", () => {
    expect(c(null, undefined, "partner")).toBe("campaign");
  });
});
