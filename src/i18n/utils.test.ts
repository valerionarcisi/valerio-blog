import { describe, test, expect } from "vitest";
import {
  getLangFromUrl,
  useTranslations,
  getLocalizedPath,
  getSlugFromId,
  getLangFromId,
} from "./utils";

describe("getLangFromUrl", () => {
  test("/en/blog returns en", () => {
    expect(getLangFromUrl(new URL("https://x.com/en/blog"))).toBe("en");
  });

  test("/blog returns it (default)", () => {
    expect(getLangFromUrl(new URL("https://x.com/blog"))).toBe("it");
  });

  test("/ returns it (default)", () => {
    expect(getLangFromUrl(new URL("https://x.com/"))).toBe("it");
  });

  test("/fr/page returns it (unknown lang fallback)", () => {
    expect(getLangFromUrl(new URL("https://x.com/fr/page"))).toBe("it");
  });
});

describe("useTranslations", () => {
  test("it key returns Italian string", () => {
    const t = useTranslations("it");
    expect(t("nav.about")).toBe("Chi Sono");
  });

  test("en key returns English string", () => {
    const t = useTranslations("en");
    expect(t("nav.about")).toBe("Who I Am");
  });
});

describe("getLocalizedPath", () => {
  test("default lang (it) returns path unchanged", () => {
    expect(getLocalizedPath("/blog", "it")).toBe("/blog");
  });

  test("en adds /en prefix", () => {
    expect(getLocalizedPath("/blog", "en")).toBe("/en/blog");
  });
});

describe("getSlugFromId", () => {
  test("extracts slug from locale/slug format", () => {
    expect(getSlugFromId("en/my-post")).toBe("my-post");
  });

  test("handles nested paths", () => {
    expect(getSlugFromId("en/sub/deep-post")).toBe("deep-post");
  });

  test("single segment returns itself", () => {
    expect(getSlugFromId("my-post")).toBe("my-post");
  });
});

describe("getLangFromId", () => {
  test("en prefix returns en", () => {
    expect(getLangFromId("en/my-post")).toBe("en");
  });

  test("it prefix returns it", () => {
    expect(getLangFromId("it/my-post")).toBe("it");
  });

  test("unknown prefix returns it (fallback)", () => {
    expect(getLangFromId("fr/my-post")).toBe("it");
  });
});
