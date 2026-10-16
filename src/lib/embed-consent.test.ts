import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describeEmbed, embedConsentBlock, privacyFriendlySrc } from "./embed-consent";

describe("describeEmbed", () => {
  test("YouTube, also its nocookie domain, links to the watch page", () => {
    expect(describeEmbed("https://www.youtube.com/embed/eYZFIZGJvLY?si=x")).toEqual({
      provider: "YouTube",
      open: "https://www.youtube.com/watch?v=eYZFIZGJvLY",
    });
    expect(describeEmbed("https://www.youtube-nocookie.com/embed/abc")?.provider).toBe("YouTube");
  });
  test("Embedly names the wrapped provider and links to it", () => {
    const info = describeEmbed(
      "https://cdn.embedly.com/widgets/media.html?src=https://www.relive.com/view/vPOpKNGAVEv/widget?r=embed-site&type=text/html",
    );
    expect(info?.provider).toBe("Relive");
    expect(info?.open).toBe("https://www.relive.com/view/vPOpKNGAVEv/widget");
  });
  test("our own site and invalid URLs are not third-party embeds", () => {
    expect(describeEmbed("https://valerionarcisi.me/x")).toBeNull();
    expect(describeEmbed("/relative/path")).toBeNull();
    expect(describeEmbed("http://[bad")).toBeNull();
  });
  test("an unknown provider falls back to its hostname", () => {
    expect(describeEmbed("https://player.example.org/e/1")?.provider).toBe("player.example.org");
  });
});

describe("embedConsentBlock", () => {
  const block = embedConsentBlock({
    src: "https://www.youtube.com/embed/abc?si=1&x=2",
    lang: "it",
    title: 'Video "uno"',
    height: 315,
    attrs: { allow: "fullscreen" },
  });
  test("loads nothing from the provider: no iframe, no src attribute", () => {
    expect(block).not.toMatch(/<iframe/i);
    expect(block).not.toMatch(/\ssrc=/i);
    expect(block).toContain('data-embed-src="https://www.youtube.com/embed/abc?si=1&amp;x=2"');
  });
  test("has the button, a plain link to the provider and the privacy link", () => {
    expect(block).toContain('<button type="button" class="embed-consent__btn">Carica il contenuto</button>');
    expect(block).toContain('href="https://www.youtube.com/watch?v=abc"');
    expect(block).toContain('href="/privacy-policy"');
  });
  test("escapes attribute values", () => {
    // the title travels inside a JSON attribute: JSON-escaped, then HTML-escaped
    expect(block).toContain("Video \\&quot;uno\\&quot;");
    expect(block).not.toContain('"Video "uno""');
  });
  test("English copy and policy link", () => {
    const en = embedConsentBlock({ src: "https://www.youtube.com/embed/abc", lang: "en" });
    expect(en).toContain("Load the content");
    expect(en).toContain('href="/en/privacy-policy"');
  });
  test("refuses our own URLs", () => {
    expect(() => embedConsentBlock({ src: "https://valerionarcisi.me/x" })).toThrow();
  });
  test("keeps the authored size for the iframe created on click", () => {
    expect(block).toContain("&quot;width&quot;:&quot;100%&quot;");
    expect(block).toContain("&quot;height&quot;:&quot;315&quot;");
  });
  test("is a single line so markdown keeps it as one raw HTML block", () => {
    expect(block).not.toContain("\n");
  });
});

describe("privacyFriendlySrc", () => {
  test("YouTube goes through the privacy-enhanced domain, other hosts are untouched", () => {
    expect(privacyFriendlySrc("https://www.youtube.com/embed/abc?si=1")).toBe(
      "https://www.youtube-nocookie.com/embed/abc?si=1",
    );
    expect(privacyFriendlySrc("https://cdn.embedly.com/widgets/media.html?src=x")).toBe(
      "https://cdn.embedly.com/widgets/media.html?src=x",
    );
    expect(privacyFriendlySrc("not a url")).toBe("not a url");
  });
});

describe("content policy: no raw third-party iframes in posts", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
    });
  test("every embed goes through the click-to-load block", () => {
    const offenders = walk("src/content").filter((f) => /<iframe\b/i.test(readFileSync(f, "utf8")));
    expect(offenders, "use scripts/embed-consent-html.ts instead of a raw <iframe>").toEqual([]);
  });
});
