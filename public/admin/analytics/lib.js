// Shared helpers for the analytics dashboard modules.
// admin-client.js (classic script, loaded first) provides escapeHtml/apiJson/... on window.

export const esc = (v) => window.escapeHtml(v);
export const apiJson = (url, init) => window.apiJson(url, init);
export const apiFetch = (url, init) => window.apiFetch(url, init);
export const JSON_HEADERS = { "Content-Type": "application/json" };

export const $ = (id) => document.getElementById(id);

const nf = new Intl.NumberFormat("it-IT");
export const fmtInt = (n) => nf.format(Number(n) || 0);
export function fmt(n) {
  n = Number(n) || 0;
  return n >= 10000 ? (n / 1000).toFixed(1).replace(".", ",") + "k" : nf.format(n);
}
export function fmtDur(s) {
  s = Math.round(Number(s) || 0);
  return s >= 60 ? Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s" : s + "s";
}
export const fmtPct = (n) => (Number(n) || 0).toFixed(1).replace(".", ",") + "%";

const FLAG_BASE = 0x1f1e6;
/** Regional-indicator flag for any ISO-3166 alpha-2 code; globe when unknown. */
export function flag(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "🌐";
  const up = code.toUpperCase();
  return String.fromCodePoint(FLAG_BASE + up.charCodeAt(0) - 65, FLAG_BASE + up.charCodeAt(1) - 65);
}
let regionNames = null;
export function countryName(code) {
  if (!code) return "Sconosciuto";
  try {
    regionNames = regionNames || new Intl.DisplayNames(["it"], { type: "region" });
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}
export function deviceIcon(t) {
  return t === "mobile" ? "📱" : t === "tablet" ? "📋" : "💻";
}
const DEVICE_LABEL = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };
export const deviceLabel = (t) => DEVICE_LABEL[t] || t || "?";

// SQLite "YYYY-MM-DD HH:MM:SS" is UTC.
export const parseDb = (s) => window.parseDbDate(s);
export function relTime(s) {
  const diff = Math.floor((Date.now() - parseDb(s).getTime()) / 1000);
  if (diff < 45) return "ora";
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + " min fa";
  if (diff < 86400) return Math.round(diff / 3600) + " h fa";
  const d = Math.floor(diff / 86400);
  return d === 1 ? "ieri" : d + " g fa";
}
export function exactTime(s) {
  return parseDb(s).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "medium" });
}
export function clock(s) {
  return parseDb(s).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const todayStr = () => new Date().toISOString().slice(0, 10);
export function shiftDay(iso, delta) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function eachDay(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 800; d = shiftDay(d, 1)) out.push(d);
  return out;
}

export const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
export function fmtDayShort(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
}
export function fmtDayFull(iso) {
  return fmtDayShort(iso) + " " + iso.slice(0, 4);
}

/** Design tokens read at runtime so charts follow the CSS (no colours duplicated here). */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
export function withAlpha(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
export function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/.{2}/g) || ["00", "00", "00"];
  return m.map((x) => parseInt(x, 16));
}

// ---- states: every section always shows loading, empty or error, never blank ----
export const stateLoading = (rows = 3) => '<div aria-hidden="true">' + '<div class="ax-skel"></div>'.repeat(rows) + "</div>";
export const stateEmpty = (msg) => '<div class="ax-state">' + esc(msg || "Nessun dato nel periodo") + "</div>";
export function stateError(msg) {
  return '<div class="ax-state error" role="alert">Errore: ' + esc(msg) + '<br><button type="button" class="ax-btn" data-retry>Riprova</button></div>';
}
/** Wires the "Riprova" button inside `el` to `fn` (event delegation, so re-rendering is safe). */
export function onRetry(el, fn) {
  if (el._retry) el.removeEventListener("click", el._retry);
  el._retry = (e) => {
    if (e.target.closest("[data-retry]")) fn();
  };
  el.addEventListener("click", el._retry);
}

export function announce(msg) {
  const el = $("ax-status");
  if (el) el.textContent = msg;
}

/** Horizontal bars. rows: [{key, value, sub?}] already sorted. opts.path, opts.total (for share %), opts.tone. */
export function barsHtml(rows, opts = {}) {
  if (!rows || !rows.length) return stateEmpty(opts.empty);
  const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
  const total = opts.total || 0;
  return (
    '<ul class="ax-bars' + (opts.tone ? " " + opts.tone : "") + '">' +
    rows
      .map((r) => {
        const v = Number(r.value) || 0;
        const share = total > 0 ? "<small>" + Math.round((v / total) * 100) + "%</small>" : "";
        const label = r.key == null || r.key === "" ? opts.nullLabel || "(diretto)" : r.key;
        return (
          "<li><span class=\"k" + (opts.path ? " path" : "") + '" title="' + esc(label) + '">' + (r.prefix || "") + esc(label) + "</span>" +
          '<span class="v">' + fmt(v) + share + "</span>" +
          '<span class="bar" aria-hidden="true"><i style="width:' + Math.round((v / max) * 100) + '%"></i></span></li>'
        );
      })
      .join("") +
    "</ul>"
  );
}

export function verdictBadge(v) {
  const cls = v === "human" ? "pos" : v === "bot" ? "neg" : "warn";
  const text = v === "human" ? "umano" : v === "bot" ? "bot" : "non verificato";
  return '<span class="badge ' + cls + '">' + text + "</span>";
}

export function deltaChip(pct, opts = {}) {
  if (pct == null || Number.isNaN(Number(pct))) return '<span class="chip flat" title="Nessun confronto disponibile">— n/d</span>';
  const v = Number(pct);
  const unit = opts.unit || "%";
  const num = Math.abs(v).toFixed(1).replace(".", ",") + (unit === "pp" ? " pp" : "%");
  if (Math.abs(v) < 0.05) return '<span class="chip flat">= invariato</span>';
  return v > 0
    ? '<span class="chip pos" title="rispetto al periodo precedente">▲ +' + num + "</span>"
    : '<span class="chip neg" title="rispetto al periodo precedente">▼ −' + num + "</span>";
}

export function exportLink(kind, label = "CSV") {
  return '<a class="ax-link ax-export" data-export="' + esc(kind) + '" href="#" download>' + esc(label) + "</a>";
}
