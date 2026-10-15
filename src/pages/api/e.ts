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
  parseEngage,
  parsePageview,
  type PageviewInput,
} from "~/lib/analytics-input";
import { hasVitals } from "~/lib/analytics-vitals";
import { ONCE_PER_PAGE, parseEvent } from "~/lib/analytics-events";
import {
  addSessionEngagement,
  engagedDelta,
  markSessionHuman,
  recordSessionPageview,
} from "~/lib/analytics-sessions";
import { classifyChannel } from "~/lib/channels";
import { countryFromGeo } from "~/lib/geo";
import { checkRate } from "~/lib/rate-limit";
import {
  BOT_SCORE_RULE,
  computeBotScore,
  isScannerPath,
} from "~/lib/bot-score";
import { evaluateRules, loadRules, recordRuleHit } from "~/lib/bot-rules";

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
const OPTIONAL_COLUMNS = new Set([
  "channel",
  "visitor_hash",
  "bot_score",
  "session_id",
  "human",
]);

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

/**
 * Human status belongs to the visitor-day, not to a single pageview: the first page of a
 * visit is stored before any interaction, so it must not stay "unverified" (and drop the
 * visitor from the human counts) once a later page proves the visitor is human.
 */
async function alreadyHumanToday(
  db: Client,
  day: string,
  visitorHash: string,
): Promise<boolean> {
  try {
    const res = await db.execute({
      sql: "SELECT 1 FROM pageviews WHERE visitor_hash = ? AND human = 1 AND created_at >= ? LIMIT 1",
      args: [visitorHash, day],
    });
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/** Marks every pageview of the visitor-day as human (the engage signal covers the whole visit). */
async function markVisitorDayHuman(
  db: Client,
  day: string,
  visitorHash: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE pageviews SET human = 1
          WHERE visitor_hash = ? AND created_at >= ? AND created_at < datetime(?, '+1 day')`,
    args: [visitorHash, day, day],
  });
}

/** Pageviews this hash stored in the last minute (rate signal). Fail-quiet: 0 on error. */
async function recentPageviews(
  db: Client,
  visitorHash: string,
): Promise<number> {
  try {
    const res = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM pageviews WHERE visitor_hash = ? AND created_at >= datetime('now', '-1 minute')",
      args: [visitorHash],
    });
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return 0;
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
    botScore: number;
    sessionId: number | null;
    channel: string;
    human: boolean;
  },
): Record<string, InValue> {
  return {
    session_id: extra.sessionId,
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
    channel: extra.channel,
    browser: extra.browser,
    os: extra.os,
    device_type: deviceTypeFromViewport(p.viewportWidth ?? undefined),
    screen_width: p.screenWidth,
    screen_height: p.screenHeight,
    viewport_width: p.viewportWidth,
    viewport_height: p.viewportHeight,
    language: p.language,
    country: extra.country,
    bot_score: extra.botScore,
    human: extra.human ? 1 : 0,
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
  if (type !== "pageview" &&
    type !== "beacon" &&
    type !== "engage" &&
    type !== "event") {
    return new Response(null, { status: 400 });
  }

  const pv = type === "pageview" ? parsePageview(body) : null;
  const bc = type === "beacon" ? parseBeacon(body) : null;
  const en = type === "engage" ? parseEngage(body) : null;
  const ev = type === "event" ? parseEvent(body) : null;
  const input = pv ?? bc ?? en ?? ev;
  if (!input || !input.ok) return noContent();
  // Scanner probes (/wp-login.php, /.env, *.php...): drop, store nothing.
  if (pv?.ok && isScannerPath(pv.value.pathname)) return noContent();

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

  if (bc?.ok || en?.ok || ev?.ok) {
    // A beacon/engage sent just after midnight UTC was hashed with yesterday's salt.
    const hashes = [visitorHash];
    const yesterday = shiftDay(today, -1);
    const yesterdaySalt = await peekSalt(db, yesterday);
    if (yesterdaySalt) {
      hashes.push(
        await generateVisitorHash(yesterdaySalt, hostname, ip, ua ?? ""),
      );
    }
    const inHashes = hashes.map(() => "?").join(", ");
    if (en?.ok) {
      try {
        const upd = await db.execute({
          sql: `UPDATE pageviews SET human = 1
                WHERE page_id = ? AND visitor_hash IN (${inHashes})`,
          args: [en.value.pageId, ...hashes],
        });
        // only an engage that matched one of this visitor's own pageviews vouches for the visit
        if (upd.rowsAffected > 0) {
          await markVisitorDayHuman(db, today, hashes[0]);
          if (hashes[1]) await markVisitorDayHuman(db, yesterday, hashes[1]);
        }
      } catch {
        /* migration not applied: no human column yet */
      }
      try {
        // the session is human as soon as ANY of its pageviews is
        const s = await db.execute({
          sql: `SELECT session_id FROM pageviews
                WHERE page_id = ? AND visitor_hash IN (${inHashes}) AND session_id IS NOT NULL LIMIT 1`,
          args: [en.value.pageId, ...hashes],
        });
        if (s.rows[0]) await markSessionHuman(db, Number(s.rows[0].session_id));
      } catch {
        /* sessions not migrated */
      }
      return noContent();
    }
    if (ev?.ok) {
      const e = ev.value;
      try {
        // Bound to a pageview of THIS visitor (today's or yesterday's salt): same rule as beacons.
        const pv0 = await db.execute({
          sql: `SELECT session_id, pathname, visitor_hash FROM pageviews
                WHERE page_id = ? AND visitor_hash IN (${inHashes}) LIMIT 1`,
          args: [e.pageId, ...hashes],
        });
        const row = pv0.rows[0];
        if (!row) return noContent();
        const sessionId = row.session_id == null ? null : Number(row.session_id);
        const vals = [
          today,
          sessionId,
          String(row.visitor_hash),
          e.name,
          String(row.pathname),
          e.prop,
          e.pageId,
        ];
        const cols = "day, session_id, visitor_hash, name, path, prop, page_id";
        await db.execute(
          ONCE_PER_PAGE.has(e.name)
            ? {
                sql: `INSERT INTO events (${cols})
                      SELECT ?, ?, ?, ?, ?, ?, ?
                      WHERE NOT EXISTS (SELECT 1 FROM events WHERE page_id = ? AND name = ?)`,
                args: [...vals, e.pageId, e.name],
              }
            : {
                sql: `INSERT INTO events (${cols}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: vals,
              },
        );
      } catch {
        /* events table missing (migration not applied): drop */
      }
      return noContent();
    }
    if (!bc?.ok) return noContent();
    const b = bc.value;
    let beforeTime = 0;
    let sessionId: number | null = null;
    try {
      const prev = await db.execute({
        sql: `SELECT session_id, time_on_page FROM pageviews
              WHERE page_id = ? AND visitor_hash IN (${inHashes}) LIMIT 1`,
        args: [b.pageId, ...hashes],
      });
      beforeTime = Number(prev.rows[0]?.time_on_page) || 0;
      sessionId =
        prev.rows[0]?.session_id == null ? null : Number(prev.rows[0].session_id);
    } catch {
      /* sessions not migrated */
    }
    await db.execute({
      sql: `UPDATE pageviews
            SET time_on_page = MAX(COALESCE(time_on_page, 0), ?),
                scroll_depth = MAX(COALESCE(scroll_depth, 0), ?)
            WHERE page_id = ? AND visitor_hash IN (${inHashes})`,
      args: [b.timeOnPage ?? 0, b.scrollDepth ?? 0, b.pageId, ...hashes],
    });
    if (hasVitals(b.vitals)) {
      try {
        // LCP / INP: latest non-null value wins (the tracker sends the running value).
        // CLS only grows within a page view: MAX. Separate statement so a database
        // without the phase-5 columns still gets time/scroll above.
        await db.execute({
          sql: `UPDATE pageviews
                SET lcp_ms = COALESCE(?, lcp_ms),
                    inp_ms = COALESCE(?, inp_ms),
                    cls_milli = CASE WHEN ? IS NULL THEN cls_milli ELSE MAX(COALESCE(cls_milli, 0), ?) END
                WHERE page_id = ? AND visitor_hash IN (${inHashes})`,
          args: [
            b.vitals.lcpMs,
            b.vitals.inpMs,
            b.vitals.clsMilli,
            b.vitals.clsMilli,
            b.pageId,
            ...hashes,
          ],
        });
      } catch {
        /* migration not applied: no vitals columns yet */
      }
    }
    if (sessionId != null) {
      try {
        await addSessionEngagement(
          db,
          sessionId,
          engagedDelta(beforeTime, b.timeOnPage),
          new Date(),
        );
      } catch {
        /* best effort */
      }
    }
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

  const { score } = computeBotScore({
    headers: request.headers,
    ua,
    viewportWidth: p.viewportWidth,
    viewportHeight: p.viewportHeight,
    language: p.language,
    timezone: p.timezone,
    recentPageviews: await recentPageviews(db, visitorHash),
  });
  const matched = evaluateRules(await loadRules(db), {
    ua,
    referrerHost: p.referrerHost,
    pathname: p.pathname,
    visitorHash,
    now: new Date(),
  });
  if (matched) await recordRuleHit(db, matched.id);

  const botScore = matched ? BOT_SCORE_RULE : score;
  const human = await alreadyHumanToday(db, today, visitorHash);
  const channel = classifyChannel({
    referrerHost: p.referrerHost,
    utmSource: p.utmSource,
    utmMedium: p.utmMedium,
  });
  let sessionId: number | null = null;
  try {
    sessionId = await recordSessionPageview(db, {
      visitorHash,
      pathname: p.pathname,
      channel,
      referrer: p.referrerHost,
      country,
      deviceType: deviceTypeFromViewport(p.viewportWidth ?? undefined),
      botScore,
      now: new Date(),
    });
  } catch {
    /* sessions table missing (migration not applied): pageview is stored anyway */
  }

  await insertPageview(
    db,
    buildRow(p, {
      visitorHash,
      isUnique,
      browser,
      os,
      country,
      botScore,
      sessionId,
      channel,
      human,
    }),
  );
  return noContent();
};
