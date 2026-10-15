/**
 * Custom events whitelist (Analytics v2 / phase 2). Anything not listed here,
 * or with an invalid prop, is dropped by /api/e. Props are tiny, validated and
 * never free text: they cannot carry personal data.
 */
export const EVENT_NAMES = [
  "clap",
  "comment_submit",
  "comment_like",
  "contact_submit",
  "outbound_click",
  "download",
  "not_found",
  "scroll_75",
  "scroll_100",
  "copy_code",
  "share",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const DOWNLOAD_EXTENSIONS = [
  "pdf",
  "zip",
  "epub",
  "mp3",
  "mp4",
  "docx",
  "xlsx",
] as const;
export const SHARE_NETWORKS = [
  "x",
  "twitter",
  "linkedin",
  "reddit",
  "facebook",
  "whatsapp",
  "telegram",
  "email",
  "copy",
  "native",
] as const;

/** Events that are meaningful once per page view: the server dedupes by page_id. */
export const ONCE_PER_PAGE: ReadonlySet<string> = new Set([
  "scroll_75",
  "scroll_100",
]);

import { isAllowedHost, validatePageId, type Parsed } from "./analytics-input";

export const MAX_PROP = 100;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

export type EventValidation =
  | { ok: true; name: EventName; prop: string | null }
  | { ok: false; reason: string };

function cleanHost(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const h = v.trim().toLowerCase();
  return h.length > 0 && h.length <= MAX_PROP && HOST_RE.test(h) ? h : null;
}

export function validateEvent(name: unknown, prop: unknown): EventValidation {
  if (
    typeof name !== "string" ||
    !(EVENT_NAMES as readonly string[]).includes(name)
  ) {
    return { ok: false, reason: "name" };
  }
  const n = name as EventName;
  switch (n) {
    case "outbound_click": {
      const h = cleanHost(prop);
      return h ? { ok: true, name: n, prop: h } : { ok: false, reason: "prop" };
    }
    case "download": {
      const ext =
        typeof prop === "string"
          ? prop.trim().toLowerCase().replace(/^\./, "")
          : "";
      return (DOWNLOAD_EXTENSIONS as readonly string[]).includes(ext)
        ? { ok: true, name: n, prop: ext }
        : { ok: false, reason: "prop" };
    }
    case "share": {
      const net = typeof prop === "string" ? prop.trim().toLowerCase() : "";
      return (SHARE_NETWORKS as readonly string[]).includes(net)
        ? { ok: true, name: n, prop: net }
        : { ok: false, reason: "prop" };
    }
    case "not_found": {
      // Referrer host, optional (direct hits have none). Present-but-invalid is dropped.
      if (prop == null || prop === "") return { ok: true, name: n, prop: null };
      const h = cleanHost(prop);
      return h ? { ok: true, name: n, prop: h } : { ok: false, reason: "prop" };
    }
    default:
      return { ok: true, name: n, prop: null };
  }
}

export interface EventInput {
  pageId: string;
  hostname: string;
  name: EventName;
  prop: string | null;
}

/** Body of a `{type:"event"}` beacon. The path is NOT trusted: the server uses the pageview's. */
export function parseEvent(body: Record<string, unknown>): Parsed<EventInput> {
  if (!isAllowedHost(body.hostname)) return { ok: false, reason: "hostname" };
  const pageId = validatePageId(body.page_id);
  if (!pageId) return { ok: false, reason: "page_id" };
  const v = validateEvent(body.name, body.prop);
  if (!v.ok) return v;
  return {
    ok: true,
    value: {
      pageId,
      hostname: body.hostname.toLowerCase(),
      name: v.name,
      prop: v.prop,
    },
  };
}
