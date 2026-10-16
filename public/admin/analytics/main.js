// Analytics dashboard entry point: top bar (period, filters, freshness), tabs, data loading.
// Tabs render lazily from ONE /api/stats payload; "Utenti" has its own paginated feed.
import {
  $, announce, apiFetch, apiJson, countryName, esc, flag, fmtDayFull, fmtDayShort, JSON_HEADERS, shiftDay, stateError, stateLoading, todayStr,
} from "./lib.js";
import { onChange, setCustom, setFilters, setPeriod, shift, state, statsUrl } from "./store.js";
import { initRealtime, onLive, renderRealtime } from "./realtime.js";
import { initOverview, onOverviewShown, renderOverview, updateOverviewPrev } from "./overview.js";
import { closeSheet, initUsers, markUsersDirty, renderUsersSummary, showUsers } from "./users.js";
import { initAcquisition, renderAcquisition } from "./acquisition.js";
import { renderEngagement } from "./engagement.js";
import { renderTech } from "./tech.js";
import { initQuality, renderQuality } from "./quality.js";
import { initRules, loadRules } from "./rules.js";

const TAB_IDS = ["panoramica", "utenti", "acquisizione", "coinvolgimento", "tecnologia", "bot"];
// Containers filled from the stats payload, per panel (used for the shared loading / error states).
const BODIES = {
  panoramica: ["scorecards", "ov-top", "ov-channels", "ov-countries", "ov-devices"],
  acquisizione: ["aq-channels", "aq-referrers", "aq-utm-sources", "aq-utm-campaigns", "aq-landing"],
  coinvolgimento: ["en-pages", "en-sections", "en-engaged", "en-entry", "en-exit", "en-events", "en-goals"],
  tecnologia: ["te-devices", "te-browsers", "te-os", "te-languages", "vitals-state", "te-slow"],
  bot: ["quality", "review-box", "recent-box"],
};
const RENDER = {
  panoramica: (d) => renderOverview(d),
  acquisizione: (d) => renderAcquisition(d.stats),
  coinvolgimento: (d) => renderEngagement(d.stats),
  tecnologia: (d) => renderTech(d.stats),
  bot: (d) => renderQuality(d.stats),
};

const data = { stats: null, prev: null, status: "idle", error: null, version: 0, seq: 0 };
const rendered = {};
let activeTab = "panoramica";
const knownCountries = {};

const fill = (tab, html) => (BODIES[tab] || []).forEach((id) => ($(id).innerHTML = html));

// ---------- tabs ----------
function selectTab(id, { focus = false, updateHash = true } = {}) {
  if (!TAB_IDS.includes(id)) id = "panoramica";
  closeSheet();
  activeTab = id;
  TAB_IDS.forEach((t) => {
    const on = t === id;
    const tab = $("tab-" + t);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    $("panel-" + t).hidden = !on;
    if (on && focus) tab.focus();
  });
  if (updateHash && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  showTab(id);
}

function showTab(id) {
  if (id === "utenti") {
    showUsers();
    return;
  }
  if (data.status === "ready" && rendered[id] !== data.version) {
    RENDER[id](data);
    rendered[id] = data.version;
    updateExportLinks();
  } else if (data.status === "loading") fill(id, stateLoading(3));
  else if (data.status === "error") fill(id, errorHtml());
  if (id === "panoramica") {
    onOverviewShown();
    ensurePrev();
  }
}

function initTabs() {
  const list = $("tabs");
  list.addEventListener("click", (e) => {
    const b = e.target.closest('[role="tab"]');
    if (b) selectTab(b.dataset.tab);
  });
  list.addEventListener("keydown", (e) => {
    const i = TAB_IDS.indexOf(activeTab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TAB_IDS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(TAB_IDS[(next + TAB_IDS.length) % TAB_IDS.length], { focus: true });
  });
  window.addEventListener("hashchange", () => selectTab(location.hash.slice(1), { updateHash: false }));
}

// ---------- data ----------
const errorHtml = () => stateError(data.error).replace("data-retry", "data-retry-stats");

function loadStats() {
  const seq = ++data.seq;
  data.status = "loading";
  data.prev = null;
  if (activeTab !== "utenti") fill(activeTab, stateLoading(3));
  return apiJson(statsUrl())
    .then((stats) => {
      if (seq !== data.seq) return;
      data.stats = stats;
      data.version++;
      data.status = "ready";
      data.error = null;
      renderBar(stats);
      showTab(activeTab);
      announce("Dati aggiornati");
    })
    .catch((e) => {
      if (seq !== data.seq) return;
      data.status = "error";
      data.error = e.message;
      if (activeTab !== "utenti") fill(activeTab, errorHtml());
    });
}

function ensurePrev() {
  const s = data.stats;
  if (data.status !== "ready" || data.prev || !s || !s.summary.prev_period) return;
  const seq = data.seq;
  const { from, to } = s.summary.prev_period;
  apiJson(statsUrl({ range: { from, to } }))
    .then((prev) => {
      if (seq !== data.seq) return;
      data.prev = prev;
      updateOverviewPrev(data);
    })
    .catch((e) => console.error("previous period failed", e));
}

// ---------- top bar ----------
function renderRange() {
  const { from, to, period } = state;
  $("range-label").textContent = from === to ? fmtDayFull(from) : period === "12m" ? fmtDayFull(from) + " — " + fmtDayFull(to) : fmtDayShort(from) + " — " + fmtDayFull(to);
  document.querySelectorAll("#periods button[data-period]").forEach((b) => {
    if (b.dataset.period !== "custom") b.setAttribute("aria-pressed", String(b.dataset.period === period));
    else b.setAttribute("aria-pressed", String(period === "custom"));
  });
  $("nav-next").disabled = state.to >= todayStr();
  $("date-from").value = from;
  $("date-to").value = to;
}

function syncCountryOptions(rows) {
  (rows || []).forEach((r) => r.country && (knownCountries[r.country] = true));
  if (state.filters.country) knownCountries[state.filters.country] = true;
  $("f-country").innerHTML =
    '<option value="">Tutti</option>' +
    Object.keys(knownCountries)
      .sort()
      .map((c) => '<option value="' + esc(c) + '"' + (c === state.filters.country ? " selected" : "") + ">" + esc(flag(c) + " " + countryName(c)) + "</option>")
      .join("");
}

function renderBar(stats) {
  const f = stats.filters || {};
  const note = $("filter-note");
  $("f-reset").hidden = !f.active;
  const n = ["country", "device", "channel"].filter((k) => state.filters[k]).length;
  $("filters-count").hidden = n === 0;
  $("filters-count").textContent = String(n);
  if (!f.active) {
    note.hidden = true;
    note.textContent = "";
  } else {
    note.hidden = false;
    note.textContent =
      "Filtri attivi: i dati vengono letti dalle visite grezze (conservate " + (f.retention_days || 90) + " giorni), non dagli aggregati." +
      (f.clamped ? " Periodo ridotto a partire dal " + (stats.period && stats.period.from) + "." : "") +
      " Il confronto col periodo precedente c'è solo se rientra nella finestra.";
  }
  syncCountryOptions(stats.countries);
  const src = stats.source || { rollup_days: 0, raw_days: 0 };
  $("data-source").textContent = src.rollup_days + " giorni da aggregati, " + src.raw_days + " dal vivo";
}

function updateExportLinks() {
  document.querySelectorAll("a.ax-export").forEach((a) => {
    a.href = window.csvExportUrl(a.dataset.export, {
      from: state.from, to: state.to, include: state.includeAll ? "all" : "",
      country: state.filters.country, device: state.filters.device, channel: state.filters.channel,
    });
  });
}

function recalcRollups() {
  const s = data.stats;
  if (!s) return;
  const status = $("rollup-status");
  const btn = $("rollup-recalc");
  const yesterday = shiftDay(todayStr(), -1);
  const to = s.period.to < yesterday ? s.period.to : yesterday;
  let from = s.period.from;
  const maxFrom = shiftDay(to, -399);
  if (from < maxFrom) from = maxFrom;
  if (from > to) {
    status.textContent = "Nessun giorno chiuso nel periodo";
    return;
  }
  btn.disabled = true;
  status.textContent = "Ricalcolo " + from + " → " + to + "…";
  apiFetch("/api/admin/analytics-rollup", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ from, to }) })
    .then((r) => r.json())
    .then((j) => {
      status.textContent = "Ricalcolati " + j.days + " giorni";
      loadStats();
    })
    .catch((e) => (status.textContent = "Errore: " + e.message))
    .then(() => (btn.disabled = false));
}

function initBar() {
  $("periods").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-period]");
    if (!b) return;
    if (b.dataset.period === "custom") {
      const open = !$("custom-range").classList.contains("open");
      $("custom-range").classList.toggle("open", open);
      b.setAttribute("aria-expanded", String(open));
      if (open) $("date-from").focus();
      return;
    }
    $("custom-range").classList.remove("open");
    setPeriod(b.dataset.period);
  });
  $("date-go").addEventListener("click", () => {
    if (setCustom($("date-from").value, $("date-to").value)) $("custom-range").classList.remove("open");
    else announce("Intervallo di date non valido");
  });
  $("nav-prev").addEventListener("click", () => shift(-1));
  $("nav-next").addEventListener("click", () => shift(1));

  const readFilters = () =>
    setFilters({ country: $("f-country").value, device: $("f-device").value, channel: $("f-channel").value });
  ["f-country", "f-device", "f-channel"].forEach((id) => $(id).addEventListener("change", readFilters));
  $("f-reset").addEventListener("click", () => {
    ["f-country", "f-device", "f-channel"].forEach((id) => ($(id).value = ""));
    readFilters();
  });
  $("filters-toggle").addEventListener("click", () => {
    const open = !$("filters-panel").classList.contains("open");
    $("filters-panel").classList.toggle("open", open);
    $("filters-toggle").setAttribute("aria-expanded", String(open));
  });
  $("rollup-recalc").addEventListener("click", recalcRollups);
  $("live-pill").addEventListener("click", () => selectTab("panoramica"));
  $("ax-main").addEventListener("click", (e) => {
    if (e.target.closest("[data-retry-stats]")) loadStats();
  });
}

onChange((why) => {
  renderRange();
  markUsersDirty();
  if (why === "include" || why === "period" || why === "filters") loadStats();
  if (activeTab === "utenti" && why !== "include") showUsers();
});

// ---------- boot ----------
initBar();
initTabs();
initOverview();
initAcquisition();
initUsers();
initRules();
initQuality({ reload: loadStats, range: () => ({ from: state.from, to: state.to }) });
onLive(renderUsersSummary);
renderRange();
renderRealtime();
renderUsersSummary();
selectTab(location.hash.slice(1) || "panoramica", { updateHash: false });
loadStats();
loadRules();
initRealtime();
