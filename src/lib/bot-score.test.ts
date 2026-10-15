import { describe, test, expect } from "vitest";
import {
  BOT_SCORE_THRESHOLD,
  claimsModernBrowser,
  computeBotScore,
  isScannerPath,
  languageTimezoneMismatch,
  viewportIsImpossible,
} from "./bot-score";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_OLD =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1";

const goodHeaders = () =>
  new Headers({ "accept-language": "it-IT", "sec-fetch-site": "same-origin" });

describe("computeBotScore", () => {
  test("a normal browser scores 0", () => {
    const r = computeBotScore({
      headers: goodHeaders(),
      ua: CHROME,
      viewportWidth: 1440,
      viewportHeight: 900,
      language: "it-IT",
      timezone: "Europe/Rome",
    });
    expect(r).toEqual({ score: 0, reasons: [] });
  });

  test("missing Accept-Language: +3", () => {
    const h = goodHeaders();
    h.delete("accept-language");
    expect(computeBotScore({ headers: h, ua: CHROME }).score).toBe(3);
  });

  test("missing Sec-Fetch-* on a modern Chrome: +3; old Safari is not penalised", () => {
    const h = new Headers({ "accept-language": "en" });
    expect(computeBotScore({ headers: h, ua: CHROME }).score).toBe(3);
    expect(computeBotScore({ headers: h, ua: SAFARI_OLD }).score).toBe(0);
    expect(computeBotScore({ headers: h, ua: "curl/8.0" }).score).toBe(0);
  });

  test("impossible viewport: +2 (missing is not scored)", () => {
    const base = { headers: goodHeaders(), ua: CHROME };
    expect(computeBotScore({ ...base, viewportWidth: 0 }).score).toBe(2);
    expect(computeBotScore({ ...base, viewportHeight: 99999 }).score).toBe(2);
    expect(computeBotScore({ ...base, viewportWidth: null }).score).toBe(0);
    expect(viewportIsImpossible(1280, 720)).toBe(false);
  });

  test("language/timezone mismatch is narrow: +2 only for region-tagged languages", () => {
    expect(languageTimezoneMismatch("ja-JP", "America/New_York")).toBe(true);
    expect(languageTimezoneMismatch("it-IT", "Asia/Tokyo")).toBe(true);
    expect(languageTimezoneMismatch("it-IT", "Europe/Rome")).toBe(false);
    expect(languageTimezoneMismatch("it", "Asia/Tokyo")).toBe(false);
    expect(languageTimezoneMismatch("en-US", "Asia/Tokyo")).toBe(false);
    expect(languageTimezoneMismatch("it-IT", "UTC")).toBe(false);
    expect(
      computeBotScore({
        headers: goodHeaders(),
        ua: CHROME,
        language: "ja-JP",
        timezone: "America/New_York",
      }).score,
    ).toBe(2);
  });

  test("more than 20 pageviews/minute: +3", () => {
    const base = { headers: goodHeaders(), ua: CHROME };
    expect(computeBotScore({ ...base, recentPageviews: 20 }).score).toBe(0);
    expect(computeBotScore({ ...base, recentPageviews: 21 }).score).toBe(3);
  });

  test("signals add up and cross the threshold", () => {
    const r = computeBotScore({
      headers: new Headers(),
      ua: CHROME,
      viewportWidth: 0,
    });
    expect(r.score).toBe(8);
    expect(r.reasons).toEqual([
      "no-accept-language",
      "no-sec-fetch",
      "bad-viewport",
    ]);
    expect(BOT_SCORE_THRESHOLD).toBe(5);
    // no Accept-Language alone (3) stays below the threshold
    const h = goodHeaders();
    h.delete("accept-language");
    expect(computeBotScore({ headers: h, ua: CHROME }).score).toBeLessThan(
      BOT_SCORE_THRESHOLD,
    );
  });
});

describe("isScannerPath", () => {
  test.each([
    "/wp-login.php",
    "/xmlrpc.php",
    "/.env",
    "/wp-admin",
    "/wp-admin/setup-config.php",
    "/anything/shell.PHP",
    "/.git/config",
  ])("%s is a scanner path", (p) => expect(isScannerPath(p)).toBe(true));

  test.each(["/", "/blog/php-tutorial", "/blog/ciao", "/en/blog"])(
    "%s is a normal path",
    (p) => expect(isScannerPath(p)).toBe(false),
  );
});

describe("claimsModernBrowser", () => {
  test("recent engines only", () => {
    expect(claimsModernBrowser(CHROME)).toBe(true);
    expect(claimsModernBrowser("Mozilla/5.0 Firefox/120.0")).toBe(true);
    expect(claimsModernBrowser("Mozilla/5.0 Firefox/60.0")).toBe(false);
    expect(claimsModernBrowser(SAFARI_OLD)).toBe(false);
    expect(claimsModernBrowser(undefined)).toBe(false);
  });
});
