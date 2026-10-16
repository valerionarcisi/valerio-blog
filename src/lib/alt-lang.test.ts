import { describe, it, expect } from "vitest";
import { alternatePath, type Existing } from "./alt-lang";

const existing: Existing = {
  blog: (lang, slug) =>
    lang === "en"
      ? ["shared-post"].includes(slug)
      : ["shared-post", "solo-it"].includes(slug),
  films: () => true,
};

describe("alternatePath", () => {
  it("maps the home and static pages in both directions", () => {
    expect(alternatePath("/", "it", existing)).toBe("/en/");
    expect(alternatePath("/en/", "en", existing)).toBe("/");
    expect(alternatePath("/visti/", "it", existing)).toBe("/en/watched/");
    expect(alternatePath("/en/watched", "en", existing)).toBe("/visti/");
    expect(alternatePath("/contatti", "it", existing)).toBe("/en/contact/");
    expect(alternatePath("/en/code/", "en", existing)).toBe("/codice/");
  });

  it("keeps the slug when the post exists in the other language", () => {
    expect(alternatePath("/blog/shared-post/", "it", existing)).toBe(
      "/en/blog/shared-post/",
    );
    expect(alternatePath("/en/blog/shared-post/", "en", existing)).toBe(
      "/blog/shared-post/",
    );
  });

  it("falls back to the blog index when the post has no counterpart", () => {
    expect(alternatePath("/blog/solo-it/", "it", existing)).toBe("/en/blog/");
    expect(alternatePath("/en/blog/missing/", "en", existing)).toBe("/blog/");
  });

  it("sends paginated archives and tag pages to the other language's section", () => {
    expect(alternatePath("/blog/2/", "it", existing)).toBe("/en/blog/");
    expect(alternatePath("/tag/javascript/", "it", existing)).toBe("/en/tag/");
  });

  it("falls back to the other home for unknown paths", () => {
    expect(alternatePath("/boh", "it", existing)).toBe("/en/");
    expect(alternatePath("/en/boh", "en", existing)).toBe("/");
  });
});
