import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import {
  countryFromTimezone,
  parseUserAgent,
  deviceTypeFromViewport,
  isBot,
  sanitizePathname,
  extractHostname,
} from "~/lib/analytics";

export const prerender = false;

const ALLOWED_ORIGINS = [
  "https://valerionarcisi.me",
  "https://www.valerionarcisi.me",
  "http://localhost:4321",
  "http://localhost:3000",
];

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_REQUESTS = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_MAX_REQUESTS) {
    rateLimit.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

function toFiniteNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  const ua = request.headers.get("user-agent") ?? undefined;
  if (isBot(ua)) {
    return new Response(null, { status: 204 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  if (isRateLimited(ip)) {
    return new Response(null, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const type = body.type as string;

  if (type === "beacon") {
    const pageId = typeof body.page_id === "string" ? body.page_id.slice(0, 50) : null;
    if (!pageId) return new Response(null, { status: 400 });

    const timeOnPage = toFiniteNumber(body.time_on_page);
    const scrollDepth = toFiniteNumber(body.scroll_depth);

    await getDb().execute({
      sql: "UPDATE pageviews SET time_on_page = ?, scroll_depth = ? WHERE page_id = ? AND time_on_page IS NULL",
      args: [
        timeOnPage != null ? Math.min(Math.round(timeOnPage), 3600) : null,
        scrollDepth != null ? Math.min(Math.round(scrollDepth), 100) : null,
        pageId,
      ],
    });

    return new Response(null, { status: 204 });
  }

  if (type === "pageview") {
    const pathname = typeof body.pathname === "string" ? body.pathname : null;
    if (!pathname) return new Response(null, { status: 400 });

    const { browser, os } = parseUserAgent(ua);
    const hostname = typeof body.hostname === "string" ? body.hostname.slice(0, 100) : "valerionarcisi.me";
    const pageId = typeof body.page_id === "string" ? body.page_id.slice(0, 50) : crypto.randomUUID().slice(0, 8);

    await getDb().execute({
      sql: `INSERT INTO pageviews (
        page_id, hostname, pathname, referrer,
        utm_source, utm_medium, utm_campaign, utm_content,
        is_unique, browser, os, device_type,
        screen_width, screen_height, viewport_width, viewport_height,
        language, country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        pageId,
        hostname,
        sanitizePathname(pathname),
        extractHostname(body.referrer as string | undefined),
        typeof body.utm_source === "string" ? body.utm_source.slice(0, 200) : null,
        typeof body.utm_medium === "string" ? body.utm_medium.slice(0, 200) : null,
        typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 200) : null,
        typeof body.utm_content === "string" ? body.utm_content.slice(0, 200) : null,
        body.is_unique ? 1 : 0,
        browser,
        os,
        deviceTypeFromViewport(toFiniteNumber(body.viewport_width) ?? undefined),
        toFiniteNumber(body.screen_width),
        toFiniteNumber(body.screen_height),
        toFiniteNumber(body.viewport_width),
        toFiniteNumber(body.viewport_height),
        typeof body.language === "string" ? body.language.slice(0, 10) : null,
        countryFromTimezone(typeof body.timezone === "string" ? body.timezone : undefined),
      ],
    });

    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 400 });
};
