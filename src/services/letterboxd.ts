import { parseString } from "xml2js";

export const getLetterboxdRss = async (): Promise<Response> => {
  try {
    const response = await fetch("https://letterboxd.com/valenar/rss/");

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    throw error;
  }
};

export const parseXmlContent = (xmlContent: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

const FILM_SLUG_RE = /\/film\/([^/]+)\/?$/;

export function letterboxdFilmSlug(link: string | undefined): string | null {
  if (!link) return null;
  const match = FILM_SLUG_RE.exec(link.trim());
  return match ? match[1] : null;
}

// Letterboxd emits this exact prose as the only paragraph when a film was
// logged WITHOUT a written review — it is a placeholder, not authored content.
const WATCHED_PLACEHOLDER_RE = /^Watched on \w+ \w+ \d{1,2}, \d{4}\.?$/i;

// The RSS <description> bundles the poster <img> with the optional review prose.
// We drop the poster and any links, keep only the paragraph text so the review
// reads as plain authored prose. Returns null when the entry has no real review
// (empty, or just the "Watched on …" placeholder Letterboxd auto-generates).
export function extractReviewHtml(description: string | undefined): string | null {
  if (!description) return null;

  const withoutImages = description.replace(/<img[^>]*>/gi, "");
  const paragraphs = [...withoutImages.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1].replace(/<\/?a[^>]*>/gi, "").trim())
    .filter((text) => text.length > 0);

  if (paragraphs.length === 0) return null;
  if (paragraphs.length === 1 && WATCHED_PLACEHOLDER_RE.test(paragraphs[0])) {
    return null;
  }

  return paragraphs.map((text) => `<p>${text}</p>`).join("");
}
