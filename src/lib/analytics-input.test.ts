import { describe, test, expect } from "vitest";
import {
  isAllowedHost,
  isAllowedRequestOrigin,
  validatePathname,
  validatePageId,
  normalizeUtm,
  externalReferrerHost,
  parsePageview,
  parseBeacon,
} from "./analytics-input";

const h = (o: Record<string, string>) => new Headers(o);

describe("isAllowedHost", () => {
  test("allow-list", () => {
    expect(isAllowedHost("valerionarcisi.me")).toBe(true);
    expect(isAllowedHost("www.valerionarcisi.me")).toBe(true);
    expect(isAllowedHost("localhost")).toBe(true);
    expect(isAllowedHost("evil.com")).toBe(false);
    expect(isAllowedHost("valerionarcisi.me.evil.com")).toBe(false);
    expect(isAllowedHost(undefined)).toBe(false);
  });
});

describe("isAllowedRequestOrigin", () => {
  test("valid Origin", () => {
    expect(
      isAllowedRequestOrigin(h({ origin: "https://valerionarcisi.me" })),
    ).toBe(true);
  });
  test("bad Origin", () => {
    expect(isAllowedRequestOrigin(h({ origin: "https://evil.com" }))).toBe(
      false,
    );
  });
  test("bad Origin is not rescued by a good Referer", () => {
    expect(
      isAllowedRequestOrigin(
        h({
          origin: "https://evil.com",
          referer: "https://valerionarcisi.me/",
        }),
      ),
    ).toBe(false);
  });
  test("Referer fallback", () => {
    expect(
      isAllowedRequestOrigin(
        h({ referer: "https://www.valerionarcisi.me/blog/x" }),
      ),
    ).toBe(true);
    expect(isAllowedRequestOrigin(h({ referer: "https://evil.com/" }))).toBe(
      false,
    );
    expect(isAllowedRequestOrigin(h({ referer: "not a url" }))).toBe(false);
  });
  test("neither -> rejected", () => {
    expect(isAllowedRequestOrigin(h({}))).toBe(false);
  });
});

describe("validatePathname", () => {
  test("accepts normal paths and strips query / trailing slash", () => {
    expect(validatePathname("/blog/post-1/")).toBe("/blog/post-1");
    expect(validatePathname("/")).toBe("/");
    expect(validatePathname("/it/caff%C3%A8?x=1#y")).toBe("/it/caff%C3%A8");
  });
  test("rejects", () => {
    expect(validatePathname("blog")).toBeNull();
    expect(validatePathname("//evil")).not.toBeNull(); // still a path; host is not part of it
    expect(validatePathname("/a b")).toBeNull();
    expect(validatePathname("/<script>")).toBeNull();
    expect(validatePathname("/" + "a".repeat(300))).toBeNull();
    expect(validatePathname(42)).toBeNull();
    expect(validatePathname(null)).toBeNull();
  });
});

describe("validatePageId", () => {
  test("accepts 16+ random chars, rejects short/odd", () => {
    expect(validatePageId("a1b2c3d4e5f6a7b8c9d0e1f2")).toBe(
      "a1b2c3d4e5f6a7b8c9d0e1f2",
    );
    expect(validatePageId("short")).toBeNull();
    expect(validatePageId("a".repeat(65))).toBeNull();
    expect(validatePageId("abc def ghi jkl mno")).toBeNull();
    expect(validatePageId(12345678)).toBeNull();
  });
});

describe("normalizeUtm", () => {
  test("lowercases, trims, caps at 100", () => {
    expect(normalizeUtm("  Twitter ")).toBe("twitter");
    expect(normalizeUtm("A".repeat(300))).toBe("a".repeat(100));
  });
  test("rejects empty, non-strings, markup/control chars", () => {
    expect(normalizeUtm("")).toBeNull();
    expect(normalizeUtm(5)).toBeNull();
    expect(normalizeUtm("<img src=x>")).toBeNull();
    expect(normalizeUtm("a\nb")).toBeNull();
  });
});

describe("externalReferrerHost", () => {
  test("drops own hosts", () => {
    expect(externalReferrerHost("https://valerionarcisi.me/blog")).toBeNull();
    expect(externalReferrerHost("https://www.valerionarcisi.me/")).toBeNull();
    expect(externalReferrerHost("http://localhost:4321/")).toBeNull();
  });
  test("keeps external, rejects junk", () => {
    expect(externalReferrerHost("https://News.YCombinator.com/item?id=1")).toBe(
      "news.ycombinator.com",
    );
    expect(externalReferrerHost("garbage")).toBeNull();
    expect(externalReferrerHost(null)).toBeNull();
  });
});

describe("parsePageview / parseBeacon", () => {
  const good = {
    type: "pageview",
    page_id: "a1b2c3d4e5f6a7b8c9d0e1f2",
    hostname: "valerionarcisi.me",
    pathname: "/blog/x",
    utm_source: "Twitter",
  };
  test("valid pageview", () => {
    const r = parsePageview(good);
    expect(r.ok && r.value.utmSource).toBe("twitter");
  });
  test("bad hostname / pathname / page_id", () => {
    expect(parsePageview({ ...good, hostname: "evil.com" }).ok).toBe(false);
    expect(parsePageview({ ...good, hostname: undefined }).ok).toBe(false);
    expect(parsePageview({ ...good, pathname: "nope" }).ok).toBe(false);
    expect(parsePageview({ ...good, page_id: "x" }).ok).toBe(false);
  });
  test("beacon clamps and needs a value", () => {
    const b = { page_id: good.page_id, hostname: good.hostname };
    const r = parseBeacon({ ...b, time_on_page: 99999, scroll_depth: 250 });
    expect(r.ok && r.value).toMatchObject({
      timeOnPage: 3600,
      scrollDepth: 100,
    });
    expect(parseBeacon({ ...b, time_on_page: -5, scroll_depth: 1 }).ok).toBe(
      true,
    );
    expect(parseBeacon(b).ok).toBe(false);
    expect(
      parseBeacon({ ...b, time_on_page: 1, hostname: "evil.com" }).ok,
    ).toBe(false);
  });
});
