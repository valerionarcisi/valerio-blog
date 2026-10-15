import type { Client } from "@libsql/client";
import { ALLOWED_HOSTS } from "./analytics-input";

export const RULE_KINDS = [
  "ua_contains",
  "referrer_host",
  "path_prefix",
  "hash_today",
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface BotRule {
  id: number;
  kind: RuleKind;
  value: string;
  enabled: number;
  expires_at: string | null;
}

export interface RuleContext {
  ua?: string | null;
  referrerHost?: string | null;
  pathname?: string | null;
  visitorHash?: string | null;
  now: Date;
}

/** SQLite datetime() format, UTC. */
export function sqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** hash_today rules die at the end of the UTC day they were created in. */
export function endOfUtcDay(now: Date): string {
  return sqlDate(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    ),
  );
}

export function isRuleActive(rule: BotRule, now: Date): boolean {
  if (!rule.enabled) return false;
  return !rule.expires_at || sqlDate(now) < rule.expires_at;
}

function matches(rule: BotRule, c: RuleContext): boolean {
  const v = rule.value.toLowerCase();
  if (!v) return false;
  switch (rule.kind) {
    case "ua_contains":
      return (c.ua ?? "").toLowerCase().includes(v);
    case "referrer_host":
      return (c.referrerHost ?? "").toLowerCase() === v;
    case "path_prefix":
      return (c.pathname ?? "").toLowerCase().startsWith(v);
    case "hash_today":
      return (c.visitorHash ?? "").toLowerCase() === v;
    default:
      return false;
  }
}

/** First active rule matching the request, or null. Pure. */
export function evaluateRules(
  rules: BotRule[],
  ctx: RuleContext,
): BotRule | null {
  for (const r of rules) {
    if (isRuleActive(r, ctx.now) && matches(r, ctx)) return r;
  }
  return null;
}

// Cache per process, ~60 s: ingest must not pay a query per pageview.
const CACHE_MS = 60_000;
let cache: { db: Client; at: number; rules: BotRule[] } | null = null;

export function invalidateRulesCache(): void {
  cache = null;
}

/** Never throws: without the table (migration not applied) there are simply no rules. */
export async function loadRules(
  db: Client,
  nowMs: number = Date.now(),
): Promise<BotRule[]> {
  if (cache && cache.db === db && nowMs - cache.at < CACHE_MS)
    return cache.rules;
  try {
    const res = await db.execute(
      "SELECT id, kind, value, enabled, expires_at FROM bot_rules WHERE enabled = 1",
    );
    const rules = res.rows.map((r) => ({
      id: Number(r.id),
      kind: String(r.kind) as RuleKind,
      value: String(r.value),
      enabled: Number(r.enabled),
      expires_at: r.expires_at == null ? null : String(r.expires_at),
    }));
    cache = { db, at: nowMs, rules };
    return rules;
  } catch {
    return [];
  }
}

export async function recordRuleHit(db: Client, id: number): Promise<void> {
  try {
    await db.execute({
      sql: "UPDATE bot_rules SET hits = hits + 1 WHERE id = ?",
      args: [id],
    });
  } catch {
    /* best effort */
  }
}

// Validation (admin API)
export const MAX_RULE_VALUE = 200;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;
const HASH_RE = /^[0-9a-f]{16}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export type ParsedRule =
  | { ok: true; kind: RuleKind; value: string; note: string | null }
  | { ok: false; error: string };

export function isRuleKind(k: unknown): k is RuleKind {
  return typeof k === "string" && (RULE_KINDS as readonly string[]).includes(k);
}

export function parseRuleInput(body: unknown): ParsedRule {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  if (!isRuleKind(b.kind)) return { ok: false, error: "Invalid kind" };
  if (typeof b.value !== "string") return { ok: false, error: "Invalid value" };
  let value = b.value.trim();
  if (!value) return { ok: false, error: "Empty value" };
  if (value.length > MAX_RULE_VALUE)
    return { ok: false, error: `Value too long (max ${MAX_RULE_VALUE})` };
  if (CONTROL_RE.test(value)) return { ok: false, error: "Invalid characters" };

  switch (b.kind) {
    case "ua_contains":
      if (value.length < 4)
        return { ok: false, error: "ua_contains needs at least 4 characters" };
      break;
    case "path_prefix":
      if (!value.startsWith("/") || value === "/")
        return {
          ok: false,
          error: 'path_prefix must start with "/" and not be "/"',
        };
      break;
    case "referrer_host":
      value = value.toLowerCase();
      if (!HOST_RE.test(value))
        return { ok: false, error: "referrer_host must be a hostname" };
      if (ALLOWED_HOSTS.includes(value))
        return { ok: false, error: "Cannot block the site itself" };
      break;
    case "hash_today":
      value = value.toLowerCase();
      if (!HASH_RE.test(value))
        return {
          ok: false,
          error: "hash_today needs a 16-char hex visitor hash",
        };
      break;
  }

  let note: string | null = null;
  if (b.note != null) {
    if (typeof b.note !== "string") return { ok: false, error: "Invalid note" };
    note = b.note.trim().slice(0, 300) || null;
  }
  return { ok: true, kind: b.kind, value, note };
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

/**
 * WHERE fragment selecting the stored pageviews a candidate rule would have hit.
 * ua_contains has none: the raw UA is never stored, only evaluated at ingest.
 */
export function previewClause(
  kind: RuleKind,
  value: string,
): { sql: string; args: string[] } | null {
  const v = value.toLowerCase();
  switch (kind) {
    case "referrer_host":
      return { sql: "LOWER(referrer) = ?", args: [v] };
    case "path_prefix":
      return {
        sql: "LOWER(pathname) LIKE ? ESCAPE '\\'",
        args: [escapeLike(v) + "%"],
      };
    case "hash_today":
      return { sql: "LOWER(visitor_hash) = ?", args: [v] };
    default:
      return null;
  }
}
