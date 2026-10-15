import { sanitizePathname } from "./analytics";
import { hasVitals, parseVitals, type VitalsInput } from "./analytics-vitals";

export const ALLOWED_HOSTS = [
  "valerionarcisi.me",
  "www.valerionarcisi.me",
  "localhost",
  "127.0.0.1",
];

export const ALLOWED_ORIGINS = [
  "https://valerionarcisi.me",
  "https://www.valerionarcisi.me",
  "http://localhost:4321",
  "http://localhost:3000",
  "http://127.0.0.1:4321",
  "http://127.0.0.1:3000",
];

export const MAX_PATHNAME = 300;
export const MAX_UTM = 100;

const PATH_RE = /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/;
const PAGE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isAllowedHost(host: unknown): host is string {
  return typeof host === "string" && ALLOWED_HOSTS.includes(host.toLowerCase());
}

/** Origin (or, failing that, Referer origin) must belong to the site. */
export function isAllowedRequestOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  const referer = headers.get("referer");
  if (!referer) return false;
  try {
    return ALLOWED_ORIGINS.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

export function validatePageId(value: unknown): string | null {
  return typeof value === "string" && PAGE_ID_RE.test(value) ? value : null;
}

export function validatePathname(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000) return null;
  const clean = sanitizePathname(value);
  if (clean.length > MAX_PATHNAME || !PATH_RE.test(clean)) return null;
  return clean;
}

export function normalizeUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().slice(0, MAX_UTM);
  // eslint-disable-next-line no-control-regex
  return v && !/[\u0000-\u001f\u007f<>]/.test(v) ? v : null;
}

/** Referrer hostname, or null when empty/invalid or equal to one of our own hosts. */
export function externalReferrerHost(referrer: unknown): string | null {
  if (typeof referrer !== "string" || !referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host || host.length > 100 || ALLOWED_HOSTS.includes(host)) return null;
  return host;
}

export function finiteNumber(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export interface PageviewInput {
  pageId: string;
  hostname: string;
  pathname: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  language: string | null;
  timezone: string | undefined;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parsePageview(
  body: Record<string, unknown>,
): Parsed<PageviewInput> {
  if (!isAllowedHost(body.hostname)) return { ok: false, reason: "hostname" };
  const pathname = validatePathname(body.pathname);
  if (!pathname) return { ok: false, reason: "pathname" };
  const pageId = validatePageId(body.page_id);
  if (!pageId) return { ok: false, reason: "page_id" };
  return {
    ok: true,
    value: {
      pageId,
      hostname: body.hostname.toLowerCase(),
      pathname,
      referrerHost: externalReferrerHost(body.referrer),
      utmSource: normalizeUtm(body.utm_source),
      utmMedium: normalizeUtm(body.utm_medium),
      utmCampaign: normalizeUtm(body.utm_campaign),
      utmContent: normalizeUtm(body.utm_content),
      screenWidth: finiteNumber(body.screen_width),
      screenHeight: finiteNumber(body.screen_height),
      viewportWidth: finiteNumber(body.viewport_width),
      viewportHeight: finiteNumber(body.viewport_height),
      language:
        typeof body.language === "string" ? body.language.slice(0, 10) : null,
      timezone:
        typeof body.timezone === "string"
          ? body.timezone.slice(0, 64)
          : undefined,
    },
  };
}

export interface BeaconInput {
  pageId: string;
  hostname: string;
  timeOnPage: number | null;
  scrollDepth: number | null;
  /** Web Vitals, already range-validated (null = absent or out of range). */
  vitals: VitalsInput;
}

export function parseBeacon(
  body: Record<string, unknown>,
): Parsed<BeaconInput> {
  if (!isAllowedHost(body.hostname)) return { ok: false, reason: "hostname" };
  const pageId = validatePageId(body.page_id);
  if (!pageId) return { ok: false, reason: "page_id" };
  const t = finiteNumber(body.time_on_page);
  const s = finiteNumber(body.scroll_depth);
  const vitals = parseVitals(body);
  if (t == null && s == null && !hasVitals(vitals))
    return { ok: false, reason: "empty" };
  return {
    ok: true,
    value: {
      pageId,
      hostname: body.hostname.toLowerCase(),
      timeOnPage: t != null ? Math.min(Math.max(Math.round(t), 0), 3600) : null,
      scrollDepth: s != null ? Math.min(Math.max(Math.round(s), 0), 100) : null,
      vitals,
    },
  };
}

export interface EngageInput {
  pageId: string;
  hostname: string;
}

/** Human signal: first real interaction (or 3 s of visible time) on a page. */
export function parseEngage(
  body: Record<string, unknown>,
): Parsed<EngageInput> {
  if (!isAllowedHost(body.hostname)) return { ok: false, reason: "hostname" };
  const pageId = validatePageId(body.page_id);
  if (!pageId) return { ok: false, reason: "page_id" };
  return {
    ok: true,
    value: { pageId, hostname: body.hostname.toLowerCase() },
  };
}
