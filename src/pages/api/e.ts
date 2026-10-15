import type { APIRoute } from "astro";
import type { Client, InValue } from "@libsql/client";
import getDb from "~/lib/turso";
import {
  countryFromTimezone,
  parseUserAgent,
  deviceTypeFromViewport,
  isBot,
  generateVisitorHash,
} from "~/lib/analytics";
import {
  getDailySalt,
  peekSalt,
  maybePurgeOldSalts,
  shiftDay,
  utcDay,
} from "~/lib/analytics-salt";
import {
  isAllowedRequestOrigin,
  parseBeacon,
  parsePageview,
  type PageviewInput,
} from "~/lib/analytics-input";
import { classifyChannel } from "~/lib/channels";
import { countryFromGeo } from "~/lib/geo";
import { checkRate } from "~/lib/rate-limit";

export const prerender = false;

const RATE_LIMIT = 60;
const RATE_WINDOW_SEC = 60;

export function toFiniteNumber(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

const noContent = () => new Response(null, { status: 204 });

function clientIp(request: Request): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Columns added after the first release; dropped when the migration is not applied yet. */
const OPTIONAL_COLUMNS = new Set(["channel", "visitor_hash"]);

async function insertPageview(
  db: Client,
  row: Record<string, InValue>,
): Promise<void> {
  const run = (entries: [string, InValue][]) =>
    db.execute({
      sql: `INSERT INTO pageviews (${entries.map(([k]) => k).join(", ")})
            VALUES (${entries.map(() => "?").join(", ")})`,
      args: entries.map(([, v]) => v),
    });
  const all = Object.entries(row);
  try {
    await run(all);
  } catch {
    await run(all.filter(([k]) => !OPTIONAL_COLUMNS.has(k)));
  }
}

/** Atomic first-visit-of-the-day detection. Falls back to the legacy check pre-migration. */
async function isFirstVisitToday(
  db: Client,
  day: string,
  visitorHash: string,
): Promise<boolean> {
  try {
    const res = await db.execute({
      sql: "INSERT OR IGNORE INTO daily_visitors (day, visitor_hash) VALUES (?, ?)",
      args: [day, visitorHash],
    });
    return res.rowsAffected === 1;
  } catch {
    try {
      const existing = await db.execute({
        sql: "SELECT 1 FROM pageviews WHERE visitor_hash = ? AND created_at >= ? LIMIT 1",
        args: [visitorHash, day],
      });
      return existing.rows.length === 0;
    } catch {
      return true;
    }
  }
}

function buildRow(
  p: PageviewInput,
  extra: {
    visitorHash: string;
    isUnique: boolean;
    browser: string | null;
    os: string | null;
    country: string | null;
  },
): Record<string, InValue> {
  return {
    page_id: p.pageId,
    hostname: p.hostname,
    pathname: p.pathname,
    referrer: p.referrerHost,
    utm_source: p.utmSource,
    utm_medium: p.utmMedium,
    utm_campaign: p.utmCampaign,
    utm_content: p.utmContent,
    is_unique: extra.isUnique ? 1 : 0,
    visitor_hash: extra.visitorHash,
    channel: classifyChannel({
      referrerHost: p.referrerHost,
      utmSource: p.utmSource,
      utmMedium: p.utmMedium,
    }),
    browser: extra.browser,
    os: extra.os,
    device_type: deviceTypeFromViewport(p.viewportWidth ?? undefined),
    screen_width: p.screenWidth,
    screen_height: p.screenHeight,
    viewport_width: p.viewportWidth,
    viewport_height: p.viewportHeight,
    language: p.language,
    country: extra.country,
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAllowedRequestOrigin(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const ua = request.headers.get("user-agent") ?? undefined;
  if (isBot(ua)) return noContent();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return new Response(null, { status: 400 });

  const type = body.type;
  if (type !== "pageview" && type !== "beacon") {
    return new Response(null, { status: 400 });
  }

  const pv = type === "pageview" ? parsePageview(body) : null;
  const bc = type === "beacon" ? parseBeacon(body) : null;
  const input = pv ?? bc;
  if (!input || !input.ok) return noContent();

  const db = getDb();
  const ip = clientIp(request);
  const today = utcDay();
  const hostname = input.value.hostname;
  const salt = await getDailySalt(db, today);
  const visitorHash = await generateVisitorHash(salt, hostname, ip, ua ?? "");

  if (!(await checkRate(db, `e:${visitorHash}`, RATE_LIMIT, RATE_WINDOW_SEC))) {
    return new Response(null, { status: 429 });
  }
  maybePurgeOldSalts(db, today);

  if (bc?.ok) {
    const b = bc.value;
    // A beacon sent just after midnight UTC was hashed with yesterday's salt.
    const hashes = [visitorHash];
    const yesterday = shiftDay(today, -1);
    const yesterdaySalt = await peekSalt(db, yesterday);
    if (yesterdaySalt) {
      hashes.push(
        await generateVisitorHash(yesterdaySalt, hostname, ip, ua ?? ""),
      );
    }
    await db.execute({
      sql: `UPDATE pageviews
            SET time_on_page = MAX(COALESCE(time_on_page, 0), ?),
                scroll_depth = MAX(COALESCE(scroll_depth, 0), ?)
            WHERE page_id = ? AND visitor_hash IN (${hashes.map(() => "?").join(", ")})`,
      args: [b.timeOnPage ?? 0, b.scrollDepth ?? 0, b.pageId, ...hashes],
    });
    return noContent();
  }

  if (!pv?.ok) return noContent();
  const p = pv.value;
  const { browser, os } = parseUserAgent(ua);
  const geo = (locals as { netlify?: { context?: { geo?: unknown } } })?.netlify
    ?.context?.geo;
  const country =
    countryFromGeo(request.headers, geo) ?? countryFromTimezone(p.timezone);
  const isUnique = await isFirstVisitToday(db, today, visitorHash);

  await insertPageview(
    db,
    buildRow(p, { visitorHash, isUnique, browser, os, country }),
  );
  return noContent();
};
