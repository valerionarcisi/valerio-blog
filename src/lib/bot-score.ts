/** Pageview scoring at ingest. Pure: everything it needs comes in as arguments. */

export const BOT_SCORE_THRESHOLD = 5;
/** Score stored when a manual bot rule matched. */
export const BOT_SCORE_RULE = 99;

export const WEIGHTS = {
  noAcceptLanguage: 3,
  noSecFetch: 3,
  badViewport: 2,
  langTzMismatch: 2,
  highRate: 3,
  scannerPath: 5,
} as const;

/** More pageviews than this from one hash in the last minute is not a person. */
export const RATE_PAGEVIEWS_PER_MIN = 20;

const SCANNER_EXACT = new Set([
  "/.env",
  "/xmlrpc.php",
  "/wp-login.php",
  "/wlwmanifest.xml",
  "/phpmyadmin",
]);
const SCANNER_PREFIXES = [
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/.env",
  "/.git/",
  "/phpmyadmin",
  "/cgi-bin",
];

/** Scanner probes are dropped at ingest: nothing stored. */
export function isScannerPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (SCANNER_EXACT.has(p)) return true;
  if (SCANNER_PREFIXES.some((s) => p.startsWith(s))) return true;
  return p.endsWith(".php");
}

/** True when the UA claims a browser that always sends Sec-Fetch-* on fetch(). */
export function claimsModernBrowser(ua: string | undefined | null): boolean {
  if (!ua) return false;
  const major = (re: RegExp) => {
    const m = re.exec(ua);
    return m ? Number(m[1]) : 0;
  };
  if (/Firefox\//.test(ua)) return major(/Firefox\/(\d+)/) >= 95;
  if (/(?:Chrome|CriOS)\//.test(ua) || /Edg\//.test(ua))
    return major(/(?:Chrome|CriOS)\/(\d+)/) >= 90 || major(/Edg\/(\d+)/) >= 90;
  if (/Safari\//.test(ua) && /Version\//.test(ua))
    return major(/Version\/(\d+)/) >= 17;
  return false;
}

function hasSecFetch(headers: Headers): boolean {
  return (
    headers.has("sec-fetch-site") ||
    headers.has("sec-fetch-mode") ||
    headers.has("sec-fetch-dest")
  );
}

/** 0, negative or absurd. A missing value is not scored. */
export function viewportIsImpossible(
  w: number | null | undefined,
  h: number | null | undefined,
): boolean {
  const bad = (n: number | null | undefined) =>
    n != null && (n <= 0 || n > 10000);
  return bad(w) || bad(h);
}

/** Region of a language tag mapped to the continents where it is plausible. */
const REGION_CONTINENTS: Record<string, string[]> = {
  IT: ["Europe", "Atlantic"],
  DE: ["Europe", "Atlantic"],
  FR: ["Europe", "Atlantic"],
  ES: ["Europe", "Atlantic", "Africa"],
  GB: ["Europe", "Atlantic"],
  JP: ["Asia"],
  KR: ["Asia"],
  CN: ["Asia"],
  BR: ["America"],
};

/**
 * Deliberately narrow: only region-tagged languages (it-IT, ja-JP...) paired with a timezone
 * on an unrelated continent. Expats and travellers exist, so this alone (+2) never reaches
 * the threshold.
 */
export function languageTimezoneMismatch(
  language: string | null | undefined,
  timezone: string | null | undefined,
): boolean {
  if (!language || !timezone) return false;
  const region = /^[a-z]{2,3}[-_]([A-Za-z]{2})$/
    .exec(language)?.[1]
    ?.toUpperCase();
  const home = region ? REGION_CONTINENTS[region] : undefined;
  if (!home) return false;
  const continent = timezone.split("/")[0];
  if (continent === timezone || !/^[A-Za-z]+$/.test(continent)) return false;
  return !home.includes(continent);
}

export interface ScoreInput {
  headers: Headers;
  ua: string | undefined;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  language?: string | null;
  timezone?: string | null;
  /** Pageviews already stored for this hash in the last minute. */
  recentPageviews?: number;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export function computeBotScore(i: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  const add = (w: number, why: string) => {
    score += w;
    reasons.push(why);
  };
  if (!i.headers.get("accept-language"))
    add(WEIGHTS.noAcceptLanguage, "no-accept-language");
  if (claimsModernBrowser(i.ua) && !hasSecFetch(i.headers))
    add(WEIGHTS.noSecFetch, "no-sec-fetch");
  if (viewportIsImpossible(i.viewportWidth, i.viewportHeight))
    add(WEIGHTS.badViewport, "bad-viewport");
  if (languageTimezoneMismatch(i.language, i.timezone))
    add(WEIGHTS.langTzMismatch, "lang-tz-mismatch");
  if ((i.recentPageviews ?? 0) > RATE_PAGEVIEWS_PER_MIN)
    add(WEIGHTS.highRate, "high-rate");
  return { score, reasons };
}
