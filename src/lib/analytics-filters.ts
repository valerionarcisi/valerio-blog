/**
 * Global dashboard filters (country / device / channel). Filters only exist on
 * raw rows (rollups have no cross-dimensions), so an active filter forces raw
 * reads and the range is clamped to the raw retention window.
 */
export interface Filters {
  country?: string;
  device?: string;
  channel?: string;
}

export const RETENTION_DAYS = 90;
export const DEVICES = ["mobile", "tablet", "desktop"];
export const CHANNELS = ["direct", "search", "social", "ai", "email", "referral", "campaign"];

export type FilterParse = { ok: true; value: Filters } | { ok: false; error: string };

export function parseFilters(params: URLSearchParams): FilterParse {
  const value: Filters = {};
  const country = params.get("country");
  if (country) {
    if (!/^[A-Za-z]{2}$/.test(country)) return { ok: false, error: "Invalid country" };
    value.country = country.toUpperCase();
  }
  const device = params.get("device");
  if (device) {
    if (!DEVICES.includes(device)) return { ok: false, error: "Invalid device" };
    value.device = device;
  }
  const channel = params.get("channel");
  if (channel) {
    if (!CHANNELS.includes(channel)) return { ok: false, error: "Invalid channel" };
    value.channel = channel;
  }
  return { ok: true, value };
}

export function filtersActive(f?: Filters): boolean {
  return !!f && !!(f.country || f.device || f.channel);
}

/**
 * SQL predicate (leading " AND "), valid for `pageviews` and `sessions` (same
 * column names). Values are validated against closed sets / two letters in
 * parseFilters, so inlining them as literals is safe.
 */
export function filterSql(f?: Filters): string {
  if (!f) return "";
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  let sql = "";
  if (f.country) sql += ` AND country = ${q(f.country)}`;
  if (f.device) sql += ` AND device_type = ${q(f.device)}`;
  if (f.channel) sql += ` AND channel = ${q(f.channel)}`;
  return sql;
}

/** First day (UTC) still guaranteed to be in raw pageviews. */
export function retentionFrom(today: string, days = RETENTION_DAYS): string {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** With an active filter, clamp `from` to the retention window. */
export function clampRange(
  from: string,
  to: string,
  today: string,
  f?: Filters,
): { from: string; to: string; clamped: boolean } {
  if (!filtersActive(f)) return { from, to, clamped: false };
  const min = retentionFrom(today);
  const cf = from < min ? min : from;
  return { from: cf, to: to < cf ? cf : to, clamped: cf !== from };
}
