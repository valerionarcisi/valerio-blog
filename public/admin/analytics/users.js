// Utenti: recent sessions (one row = one visit by one anonymous, daily-rotating visitor)
// with a detail sheet showing the session timeline. Privacy: only the 6-char user prefix is ever shown.
import {
  $, announce, apiFetch, apiJson, clock, countryName, deviceIcon, deviceLabel, esc, exactTime, flag, fmtDur, JSON_HEADERS,
  relTime, stateEmpty, stateError, stateLoading, onRetry, verdictBadge,
} from "./lib.js";
import { filterQuery, state } from "./store.js";
import { live, userLabel } from "./realtime.js";
import { mountRuleForm, suggestFromSession } from "./rules.js";

const LIMIT = 30;
const view = { verdict: "human", withEvents: false, items: [], cursor: null, loading: false, available: true, error: null, seq: 0, dirty: true };

const isEngaged = (s) => s.human && (s.pageviews >= 2 || s.engaged_seconds >= 10);

// ---------- summary ----------
function chips(map, render) {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return entries.length ? '<div class="ax-chips">' + entries.map(([k, n]) => '<span class="chip">' + render(k) + " · " + n + "</span>").join("") + "</div>" : '<span class="ax-muted">—</span>';
}
export function renderUsersSummary() {
  const box = $("us-summary");
  if (!box) return;
  if (!live.loaded) {
    box.innerHTML = live.error ? stateError(live.error) : stateLoading(2);
    return;
  }
  const byCountry = new Map();
  const byDevice = new Map();
  live.sessions.forEach((s) => {
    byCountry.set(s.country || "?", (byCountry.get(s.country || "?") || 0) + 1);
    byDevice.set(s.device || "?", (byDevice.get(s.device || "?") || 0) + 1);
  });
  const capped = live.sessions.length < (Number(live.active) || 0);
  box.innerHTML =
    '<div class="ax-grid cols-3" style="margin:0">' +
    '<div><div class="ax-card-title">Online ora</div><div class="ax-rt-count"><b>' + (Number(live.active) || 0) + "</b></div>" +
    (capped ? '<span class="ax-muted ax-card-meta">dettaglio sui primi ' + live.sessions.length + "</span>" : "") + "</div>" +
    '<div><div class="ax-card-title" style="margin-bottom:.4rem">Per paese</div>' + chips(byCountry, (k) => flag(k === "?" ? "" : k) + " " + esc(k === "?" ? "n/d" : countryName(k))) + "</div>" +
    '<div><div class="ax-card-title" style="margin-bottom:.4rem">Per dispositivo</div>' + chips(byDevice, (k) => deviceIcon(k) + " " + esc(deviceLabel(k))) + "</div></div>";
}

// ---------- list ----------
function rowHtml(s) {
  const channel = s.channel ? esc(s.channel) + (s.referrer ? " · " + esc(s.referrer) : "") : "diretto";
  return (
    '<li><button type="button" class="ax-sess" data-id="' + s.id + '" aria-haspopup="dialog">' +
    '<span class="flag" title="' + esc(countryName(s.country)) + '">' + flag(s.country) + "</span>" +
    '<span class="who"><span>' + esc(userLabel(s.user)) + "</span>" + verdictBadge(s.verdict) + (isEngaged(s) ? '<span class="badge info">coinvolto</span>' : "") + "</span>" +
    '<time class="when" datetime="' + esc(s.started_at.replace(" ", "T")) + 'Z" title="' + esc(exactTime(s.started_at)) + '">' + esc(relTime(s.started_at)) + "</time>" +
    '<span class="page" title="' + esc(s.entry_path || "") + '">' + esc(s.entry_path || "/") + "</span>" +
    '<span class="meta"><span>' + deviceIcon(s.device) + " " + esc(deviceLabel(s.device)) + " · " + esc(s.browser || "?") + " / " + esc(s.os || "?") + "</span>" +
    "<span>" + channel + "</span>" +
    "<span>" + s.pageviews + (s.pageviews === 1 ? " pagina" : " pagine") + " · " + esc(fmtDur(s.engaged_seconds)) + " attivi" + (s.events_count ? " · " + s.events_count + (s.events_count === 1 ? " evento" : " eventi") : "") + "</span></span>" +
    "</button></li>"
  );
}

function paint() {
  const list = $("us-list");
  const st = $("us-state");
  const more = $("us-more");
  list.innerHTML = view.items.map(rowHtml).join("");
  more.hidden = !view.cursor;
  more.disabled = view.loading;
  more.textContent = view.loading ? "Caricamento…" : "Carica altre";
  if (view.error && !view.items.length) st.innerHTML = stateError(view.error);
  else if (view.loading && !view.items.length) st.innerHTML = stateLoading(5);
  else if (!view.available) st.innerHTML = stateEmpty("Sessioni non ancora attive: applica la migrazione Fase 2.");
  else if (!view.items.length) st.innerHTML = stateEmpty("Nessun dato nel periodo");
  else st.innerHTML = view.error ? '<div class="ax-state error" role="alert">Errore: ' + esc(view.error) + ' <button type="button" class="ax-btn" data-retry>Riprova</button></div>' : "";
  $("us-count").textContent = view.items.length ? view.items.length + " sessioni caricate · una riga = una visita" : "una riga = una visita";
}

function query(cursor) {
  const q = "from=" + state.from + "&to=" + state.to + "&limit=" + LIMIT + "&verdict=" + view.verdict + (view.withEvents ? "&with_events=1" : "") + filterQuery() + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
  return "/api/stats/sessions?" + q;
}

function fetchPage(append) {
  const seq = ++view.seq;
  view.loading = true;
  view.error = null;
  if (!append) {
    view.items = [];
    view.cursor = null;
  }
  paint();
  return apiJson(query(append ? view.cursor : null))
    .then((d) => {
      if (seq !== view.seq) return;
      view.available = d.available !== false;
      view.items = view.items.concat(d.sessions || []);
      view.cursor = d.next_cursor || null;
      announce(view.items.length + " sessioni caricate");
    })
    .catch((e) => {
      if (seq === view.seq) view.error = e.message;
    })
    .then(() => {
      if (seq !== view.seq) return;
      view.loading = false;
      view.dirty = false;
      paint();
    });
}

export const markUsersDirty = () => {
  view.dirty = true;
};
export function showUsers() {
  renderUsersSummary();
  if (view.dirty) fetchPage(false);
}

// ---------- detail sheet ----------
let lastFocus = null;
const sheet = () => $("sheet");

function fact(label, value) {
  return value == null || value === "" ? "" : "<div><dt>" + esc(label) + "</dt><dd>" + value + "</dd></div>";
}
function vitalsLine(p) {
  const parts = [];
  if (p.lcp_ms != null) parts.push(vital("lcp", p.lcp_ms, "LCP"));
  if (p.inp_ms != null) parts.push(vital("inp", p.inp_ms, "INP"));
  if (p.cls != null) parts.push(vital("cls", p.cls, "CLS"));
  return parts.length ? '<span class="s">' + parts.join(" · ") + "</span>" : "";
}
function vital(metric, v, name) {
  const st = window.vitalState(metric, v) || "";
  return esc(name) + ' <b class="' + st + '">' + esc(window.fmtVital(metric, v)) + "</b>";
}

function timelineHtml(d) {
  const items = [
    ...d.pageviews.map((p) => ({ at: p.at, order: 0, p })),
    ...d.events.map((e) => ({ at: e.at, order: 1, e })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.order - b.order));
  if (!items.length) return stateEmpty("Nessuna pagina registrata per questa sessione");
  return (
    '<ol class="ax-timeline">' +
    items
      .map((it) => {
        if (it.p) {
          const p = it.p;
          const sub = [p.time_on_page != null ? "tempo sulla pagina " + fmtDur(p.time_on_page) : null, p.scroll_depth != null ? "scroll " + p.scroll_depth + "%" : null].filter(Boolean).join(" · ");
          return '<li><span class="t">' + esc(clock(p.at)) + '</span><span class="p">' + esc(p.path) + "</span>" + (sub ? '<span class="s">' + esc(sub) + "</span>" : "") + vitalsLine(p) + "</li>";
        }
        const e = it.e;
        return '<li class="ev"><span class="t">' + esc(clock(e.at)) + '</span><span class="p"><b>' + esc(e.name) + "</b>" + (e.prop ? " · " + esc(e.prop) : "") + "</span>" + (e.path ? '<span class="s">su ' + esc(e.path) + "</span>" : "") + "</li>";
      })
      .join("") +
    "</ol>"
  );
}

function detailHtml(d) {
  const s = d.session;
  const utm = [s.utm_source, s.utm_medium, s.utm_campaign].filter(Boolean).join(" / ");
  return (
    '<p style="margin:0 0 .75rem">' + verdictBadge(s.verdict) + (isEngaged(s) ? ' <span class="badge info">coinvolto</span>' : "") + ' <span class="ax-muted ax-mono">' + esc(exactTime(s.started_at)) + "</span></p>" +
    '<dl class="ax-facts">' +
    fact("Paese", flag(s.country) + " " + esc(countryName(s.country))) +
    fact("Dispositivo", deviceIcon(s.device) + " " + esc(deviceLabel(s.device))) +
    fact("Browser / OS", esc((s.browser || "?") + " / " + (s.os || "?"))) +
    fact("Lingua", esc(s.language)) +
    fact("Canale", esc(s.channel || "diretto")) +
    fact("Referrer", esc(s.referrer)) +
    fact("UTM", esc(utm)) +
    fact("Pagine", String(s.pageviews)) +
    fact("Tempo attivo", esc(fmtDur(s.engaged_seconds))) +
    fact("Eventi", String(s.events_count)) +
    "</dl>" +
    '<h3 class="ax-card-title" style="margin:0 0 .5rem">Cronologia</h3>' + timelineHtml(d) +
    '<div class="ax-actions"><button type="button" class="ax-btn" id="sheet-rule">Crea regola da questo visitatore</button>' +
    '<button type="button" class="ax-btn legacy" id="sheet-flag" title="Legacy: flag per hash, sostituito dalle regole bot">Flag come bot (legacy)</button></div>' +
    '<div id="sheet-rule-host"></div><p id="sheet-msg" class="ax-card-meta" role="status" aria-live="polite"></p>'
  );
}

function openSheet(id, trigger) {
  lastFocus = trigger || document.activeElement;
  const body = $("sheet-body");
  $("sheet-title").textContent = "Sessione";
  body.innerHTML = stateLoading(6);
  sheet().hidden = false;
  $("sheet-scrim").hidden = false;
  document.body.style.overflow = "hidden";
  $("sheet-close").focus();
  const load = () => {
    body.innerHTML = stateLoading(6);
    apiJson("/api/stats/sessions/" + id)
      .then((d) => {
        $("sheet-title").textContent = userLabel(d.session.user);
        body.innerHTML = detailHtml(d);
        $("sheet-rule").addEventListener("click", () => mountRuleForm($("sheet-rule-host"), suggestFromSession(d.session)));
        $("sheet-flag").addEventListener("click", () => legacyFlag(d.session.id, $("sheet-flag")));
      })
      .catch((e) => {
        body.innerHTML = stateError(e.message);
      });
  };
  onRetry(body, load);
  load();
}

function legacyFlag(id, btn) {
  if (!confirm("Flag legacy: segna come bot l'hash di questo visitatore (vale per tutte le sue visite di oggi). Continuare?")) return;
  btn.disabled = true;
  apiFetch("/api/admin/bot", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ sessionId: id }) })
    .then(() => {
      $("sheet-msg").textContent = "Visitatore flaggato come bot (legacy).";
      markUsersDirty();
    })
    .catch((e) => {
      btn.disabled = false;
      $("sheet-msg").textContent = "Errore: " + e.message;
    });
}

export function closeSheet() {
  if (sheet().hidden) return;
  sheet().hidden = true;
  $("sheet-scrim").hidden = true;
  document.body.style.overflow = "";
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  if (view.dirty && !$("panel-utenti").hidden) fetchPage(false);
}

function trapFocus(e) {
  if (sheet().hidden) return;
  if (e.key === "Escape") {
    closeSheet();
    return;
  }
  if (e.key !== "Tab") return;
  const f = [...sheet().querySelectorAll("button:not(:disabled), a[href], input, select, textarea")].filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function initUsers() {
  $("verdict-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-verdict]");
    if (!b) return;
    view.verdict = b.dataset.verdict;
    document.querySelectorAll("#verdict-seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fetchPage(false);
  });
  $("us-events").addEventListener("change", (e) => {
    view.withEvents = e.target.checked;
    fetchPage(false);
  });
  $("us-more").addEventListener("click", () => fetchPage(true));
  onRetry($("us-state"), () => fetchPage(false));
  $("us-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (b) openSheet(b.dataset.id, b);
  });
  $("sheet-close").addEventListener("click", closeSheet);
  $("sheet-scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", trapFocus);
  // relative times go stale while the tab stays open
  setInterval(() => {
    if (document.hidden) return;
    document.querySelectorAll("#us-list time.when").forEach((t) => {
      t.textContent = relTime(t.getAttribute("datetime"));
    });
  }, 60000);
}
