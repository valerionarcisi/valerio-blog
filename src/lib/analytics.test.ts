import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  countryFromTimezone,
  parseUserAgent,
  deviceTypeFromViewport,
  isBot,
  sanitizePathname,
  extractHostname,
  generateVisitorHash,
} from "./analytics";

describe("countryFromTimezone", () => {
  test("known timezone returns country code", () => {
    expect(countryFromTimezone("Europe/Rome")).toBe("IT");
    expect(countryFromTimezone("America/New_York")).toBe("US");
    expect(countryFromTimezone("Asia/Tokyo")).toBe("JP");
  });

  test("unknown timezone returns null", () => {
    expect(countryFromTimezone("Mars/Olympus")).toBeNull();
  });

  test("undefined returns null", () => {
    expect(countryFromTimezone(undefined)).toBeNull();
  });
});

describe("parseUserAgent", () => {
  test("Chrome on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Windows" });
  });

  test("Firefox on Linux", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Firefox", os: "Linux" });
  });

  test("Safari on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "macOS" });
  });

  test("Edge on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Edge", os: "Windows" });
  });

  test("Opera on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
    expect(parseUserAgent(ua)).toEqual({ browser: "Opera", os: "Windows" });
  });

  test("IE on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko";
    expect(parseUserAgent(ua)).toEqual({ browser: "IE", os: "Windows" });
  });

  test("Chrome on iPhone/iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS" });
  });

  test("Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Android" });
  });

  test("undefined returns null/null", () => {
    expect(parseUserAgent(undefined)).toEqual({ browser: null, os: null });
  });
});

describe("deviceTypeFromViewport", () => {
  test("undefined returns desktop", () => {
    expect(deviceTypeFromViewport(undefined)).toBe("desktop");
  });

  test("320 returns mobile", () => {
    expect(deviceTypeFromViewport(320)).toBe("mobile");
  });

  test("767 returns mobile (boundary)", () => {
    expect(deviceTypeFromViewport(767)).toBe("mobile");
  });

  test("768 returns tablet (boundary)", () => {
    expect(deviceTypeFromViewport(768)).toBe("tablet");
  });

  test("1024 returns tablet (boundary)", () => {
    expect(deviceTypeFromViewport(1024)).toBe("tablet");
  });

  test("1025 returns desktop (boundary)", () => {
    expect(deviceTypeFromViewport(1025)).toBe("desktop");
  });
});

describe("isBot", () => {
  test("undefined returns true", () => {
    expect(isBot(undefined)).toBe(true);
  });

  test("Googlebot returns true", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe(true);
  });

  test("real Chrome UA returns false", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  test("Bingbot returns true", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      ),
    ).toBe(true);
  });
});

describe("sanitizePathname", () => {
  test("removes query string", () => {
    expect(sanitizePathname("/blog/post?ref=twitter")).toBe("/blog/post");
  });

  test("removes hash", () => {
    expect(sanitizePathname("/blog/post#section")).toBe("/blog/post");
  });

  test("removes trailing slash", () => {
    expect(sanitizePathname("/blog/post/")).toBe("/blog/post");
  });

  test("keeps root slash", () => {
    expect(sanitizePathname("/")).toBe("/");
  });

  test("truncates to 500 chars", () => {
    const long = "/" + "a".repeat(600);
    expect(sanitizePathname(long).length).toBe(500);
  });

  test("handles combined query + hash + trailing slash", () => {
    expect(sanitizePathname("/blog/?q=1#top")).toBe("/blog");
  });
});

describe("extractHostname", () => {
  test("valid URL returns hostname", () => {
    expect(extractHostname("https://www.google.com/search?q=test")).toBe(
      "www.google.com",
    );
  });

  test("invalid URL returns null", () => {
    expect(extractHostname("not-a-url")).toBeNull();
  });

  test("undefined returns null", () => {
    expect(extractHostname(undefined)).toBeNull();
  });
});

describe("generateVisitorHash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns 16 char hex string", async () => {
    const hash = await generateVisitorHash("example.com", "1.2.3.4", "Chrome");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test("is deterministic", async () => {
    const h1 = await generateVisitorHash("example.com", "1.2.3.4", "Chrome");
    const h2 = await generateVisitorHash("example.com", "1.2.3.4", "Chrome");
    expect(h1).toBe(h2);
  });

  test("different inputs produce different hashes", async () => {
    const h1 = await generateVisitorHash("example.com", "1.2.3.4", "Chrome");
    const h2 = await generateVisitorHash("example.com", "5.6.7.8", "Chrome");
    expect(h1).not.toBe(h2);
  });
});
