import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import {
  countryFromTimezone,
  parseUserAgent,
  deviceTypeFromViewport,
  isBot,
  sanitizePathname,
  extractHostname,
  generateVisitorHash,
} from "~/lib/analytics";

export const prerender = false;

const ALLOWED_ORIGINS = [
  "https://valerionarcisi.me",
  "https://www.valerionarcisi.me",
  "http://localhost:4321",
  "http://localhost:3000",
  "http://127.0.0.1:4321",
  "http://127.0.0.1:3000",
];

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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";

    const { browser, os } = parseUserAgent(ua);
    const hostname = typeof body.hostname === "string" ? body.hostname.slice(0, 100) : "valerionarcisi.me";
    const pageId = typeof body.page_id === "string" ? body.page_id.slice(0, 50) : crypto.randomUUID().slice(0, 8);

    const visitorHash = await generateVisitorHash(hostname, ip, ua ?? "");
    const today = new Date().toISOString().slice(0, 10);

    let isUnique = 1;
    try {
      const existing = await getDb().execute({
        sql: "SELECT 1 FROM pageviews WHERE visitor_hash = ? AND created_at >= ? LIMIT 1",
        args: [visitorHash, today],
      });
      isUnique = existing.rows.length === 0 ? 1 : 0;
    } catch {
      // visitor_hash column may not exist yet — fall back to unique
    }

    const db = getDb();
    try {
      await db.execute({
        sql: `INSERT INTO pageviews (
          page_id, hostname, pathname, referrer,
          utm_source, utm_medium, utm_campaign, utm_content,
          is_unique, visitor_hash, browser, os, device_type,
          screen_width, screen_height, viewport_width, viewport_height,
          language, country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          pageId,
          hostname,
          sanitizePathname(pathname),
          extractHostname(body.referrer as string | undefined),
          typeof body.utm_source === "string" ? body.utm_source.slice(0, 200) : null,
          typeof body.utm_medium === "string" ? body.utm_medium.slice(0, 200) : null,
          typeof body.utm_campaign === "string" ? body.utm_campaign.slice(0, 200) : null,
          typeof body.utm_content === "string" ? body.utm_content.slice(0, 200) : null,
          isUnique,
          visitorHash,
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
    } catch {
      // Fallback: insert without visitor_hash column (pre-migration)
      await db.execute({
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
          isUnique,
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
    }

    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 400 });
};
