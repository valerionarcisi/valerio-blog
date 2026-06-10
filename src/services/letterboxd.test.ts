import { describe, it, expect } from "vitest";
import { extractReviewHtml, letterboxdFilmSlug } from "./letterboxd";

describe("letterboxdFilmSlug", () => {
  it("extracts the slug from a member film link", () => {
    expect(letterboxdFilmSlug("https://letterboxd.com/valenar/film/smart-working/")).toBe(
      "smart-working",
    );
  });

  it("handles slugs with year suffixes", () => {
    expect(letterboxdFilmSlug("https://letterboxd.com/valenar/film/backrooms-2026/")).toBe(
      "backrooms-2026",
    );
  });

  it("works without a trailing slash", () => {
    expect(letterboxdFilmSlug("https://letterboxd.com/valenar/film/conclave")).toBe("conclave");
  });

  it("returns null for undefined or non-film links", () => {
    expect(letterboxdFilmSlug(undefined)).toBeNull();
    expect(letterboxdFilmSlug("https://letterboxd.com/valenar/")).toBeNull();
  });
});

describe("extractReviewHtml", () => {
  it("returns null when description is missing", () => {
    expect(extractReviewHtml(undefined)).toBeNull();
  });

  it("returns null for a poster-only entry (no review prose)", () => {
    const description = `<p><img src="https://a.ltrbxd.com/poster.jpg"/></p>`;
    expect(extractReviewHtml(description)).toBeNull();
  });

  it("strips the poster image and keeps the review paragraphs", () => {
    const description = `<p><img src="https://a.ltrbxd.com/poster.jpg"/></p> <p>Bella sorpresa.</p>`;
    expect(extractReviewHtml(description)).toBe("<p>Bella sorpresa.</p>");
  });

  it("keeps multiple paragraphs in order", () => {
    const description = `<p><img src="x.jpg"/></p> <p>Primo.</p><p>Secondo.</p>`;
    expect(extractReviewHtml(description)).toBe("<p>Primo.</p><p>Secondo.</p>");
  });

  it("removes anchor tags but keeps their text", () => {
    const description = `<p>Vedi <a href="https://example.com">qui</a> il film.</p>`;
    expect(extractReviewHtml(description)).toBe("<p>Vedi qui il film.</p>");
  });

  it("drops empty paragraphs left after stripping the image", () => {
    const description = `<p> <img src="x.jpg"/> </p><p>Testo vero.</p>`;
    expect(extractReviewHtml(description)).toBe("<p>Testo vero.</p>");
  });

  it("returns null for the 'Watched on …' auto-placeholder (no real review)", () => {
    const description = `<p><img src="x.jpg"/></p> <p>Watched on Friday June 5, 2026.</p>`;
    expect(extractReviewHtml(description)).toBeNull();
  });

  it("returns null for the placeholder without trailing period", () => {
    const description = `<p></p> <p>Watched on Saturday May 30, 2026</p>`;
    expect(extractReviewHtml(description)).toBeNull();
  });

  it("keeps a real review even if it mentions a watch date elsewhere", () => {
    const description = `<p><img src="x.jpg"/></p> <p>Visto venerdì. Bellissimo film.</p>`;
    expect(extractReviewHtml(description)).toBe("<p>Visto venerdì. Bellissimo film.</p>");
  });
});
