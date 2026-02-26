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

export const POST: APIRoute = async ({ request }) => {
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
    const pageId = body.page_id as string;
    const timeOnPage = body.time_on_page as number | undefined;
    const scrollDepth = body.scroll_depth as number | undefined;

    if (!pageId) return new Response(null, { status: 400 });

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
    const pathname = body.pathname as string;
    if (!pathname) return new Response(null, { status: 400 });

    const { browser, os } = parseUserAgent(ua);
    const hostname = body.hostname as string || "valerionarcisi.me";

    await getDb().execute({
      sql: `INSERT INTO pageviews (
        page_id, hostname, pathname, referrer,
        utm_source, utm_medium, utm_campaign, utm_content,
        is_unique, browser, os, device_type,
        screen_width, screen_height, viewport_width, viewport_height,
        language, country
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        (body.page_id as string) || crypto.randomUUID().slice(0, 8),
        hostname,
        sanitizePathname(pathname),
        extractHostname(body.referrer as string | undefined),
        (body.utm_source as string)?.slice(0, 200) || null,
        (body.utm_medium as string)?.slice(0, 200) || null,
        (body.utm_campaign as string)?.slice(0, 200) || null,
        (body.utm_content as string)?.slice(0, 200) || null,
        body.is_unique ? 1 : 0,
        browser,
        os,
        deviceTypeFromViewport(body.viewport_width as number | undefined),
        (body.screen_width as number) || null,
        (body.screen_height as number) || null,
        (body.viewport_width as number) || null,
        (body.viewport_height as number) || null,
        (body.language as string)?.slice(0, 10) || null,
        countryFromTimezone(body.timezone as string | undefined),
      ],
    });

    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 400 });
};
