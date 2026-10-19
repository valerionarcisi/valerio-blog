// Panoramica: scorecards (value + delta + sparkline), main time chart with previous period, compact cards.
import {
  $, barsHtml, deltaChip, deviceLabel, eachDay, esc, flag, countryName, fmt, fmtDayShort, fmtDur, fmtPct, token, withAlpha,
} from "./lib.js";
import { sparkline } from "./spark.js";
import { renderWorldMap, refreshMapSize } from "./map.js";

let chart = null;
let metric = "visitors";
let current = null; // {stats, prev}

const METRIC_LABEL = { visitors: "Visitatori giornalieri", sessions: "Sessioni", pageviews: "Pageview" };

// ---------- time axis ----------
// The API only returns buckets that have data, so both periods are rebuilt on a full axis
// (every day / hour / month) and aligned by position, otherwise gaps would shift the previous series.
function axis(range, groupBy) {
  if (groupBy === "hour") {
    const day = range.from;
    const nowKey = new Date().toISOString().slice(0, 13).replace("T", " ") + ":00";
    return Array.from({ length: 24 }, (_, h) => {
      const key = day + " " + String(h).padStart(2, "0") + ":00";
      return { key, label: String(h).padStart(2, "0") + ":00", future: key > nowKey };
    });
  }
  if (groupBy === "month") {
    const keys = [];
    for (let d = new Date(range.from.slice(0, 7) + "-01T00:00:00Z"); d.toISOString().slice(0, 7) <= range.to.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) keys.push(d.toISOString().slice(0, 7));
    return keys.map((key) => ({ key, label: key.slice(5) + "/" + key.slice(2, 4) }));
  }
  return eachDay(range.from, range.to).map((key) => ({ key, label: fmtDayShort(key) }));
}

/** Values per bucket key for a metric, from a /api/stats payload. */
function seriesMap(stats, m, groupBy) {
  const out = new Map();
  if (!stats) return out;
  if (m === "sessions") {
    (stats.sessions.daily || []).forEach((d) => {
      const key = groupBy === "month" ? d.date.slice(0, 7) : d.date;
      out.set(key, (out.get(key) || 0) + d.sessions);
    });
    return out;
  }
  (stats.chart || []).forEach((c) => out.set(String(c.date), Number(c[m]) || 0));
  return out;
}

function values(stats, m, ax, groupBy) {
  const map = seriesMap(stats, m, groupBy);
  return ax.map((a) => (a.future ? null : map.get(a.key) || 0));
}

// ---------- scorecards ----------
function fillDaily(stats, pick) {
  const range = stats.period;
  if (range.groupBy === "hour") return [];
  const by = new Map((stats.sessions.daily || []).map((d) => [d.date, d]));
  return eachDay(range.from, range.to).map((day) => {
    const d = by.get(day);
    return pick(d || { sessions: 0, bounced: 0, engaged_seconds: 0, events: 0 });
  });
}

function pctChange(curr, prev) {
  if (prev == null) return null;
  if (prev === 0) return curr > 0 ? null : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function scorecards(stats) {
  const s = stats.summary;
  const se = stats.sessions;
  const off = !se.available;
  const chartVals = (m) => (stats.chart || []).map((c) => Number(c[m]) || 0);
  const engagement = off ? null : Math.round((100 - se.bounce_rate) * 10) / 10;
  const prevTime = se.prev_period && se.prev_period.avg_engaged_seconds;
  return [
    { id: "visitors", label: "Visitatori giornalieri", value: fmt(s.visitors), delta: s.visitors_delta_pct, series: chartVals("visitors"), tip: "Somma dei visitatori unici di ogni giorno: l'hash anonimo (IP + browser + data) cambia ogni giorno, quindi chi torna in 3 giorni diversi conta 3. Nessun cookie." },
    { id: "sessions", label: "Sessioni", value: off ? "—" : fmt(se.count), delta: off ? null : se.count_delta_pct, series: off ? [] : fillDaily(stats, (d) => d.sessions), tip: "Una sessione è una visita: stesso visitatore anonimo, pause inferiori a 30 minuti. A mezzanotte UTC l'identificativo cambia e una visita a cavallo si divide in due." },
    { id: "pageviews", label: "Pageview", value: fmt(s.pageviews), delta: s.pageviews_delta_pct, series: chartVals("pageviews"), tip: "Pagine totali viste nel periodo, comprese le visite ripetute." },
    { id: "time", label: "Tempo attivo medio", value: off ? "—" : fmtDur(se.avg_engaged_seconds), delta: off ? null : pctChange(se.avg_engaged_seconds, prevTime), series: off ? [] : fillDaily(stats, (d) => (d.sessions ? d.engaged_seconds / d.sessions : null)), tip: "Tempo medio in cui la pagina è rimasta visibile durante una sessione." },
    { id: "engagement", label: "Tasso di coinvolgimento", value: off ? "—" : fmtPct(engagement), delta: off || se.bounce_rate_delta_pp == null ? null : -se.bounce_rate_delta_pp, unit: "pp", series: off ? [] : fillDaily(stats, (d) => (d.sessions ? 100 - (d.bounced / d.sessions) * 100 : null)), tip: "Sessioni coinvolte: con 2 o più pagine oppure 10 o più secondi di tempo attivo. È 100 meno il bounce rate reale delle sessioni." },
    { id: "events", label: "Eventi", value: off ? "—" : fmt(se.events_total), delta: off ? null : pctChange(se.events_total, se.prev_period && se.prev_period.events_total), series: off ? [] : fillDaily(stats, (d) => d.events), tip: "Azioni anonime misurate: clap, commenti, click in uscita, download, scroll al 75% e simili." },
  ];
}

function scoreHtml(c) {
  return (
    '<article class="ax-score" aria-labelledby="sc-' + c.id + '">' +
    '<h3 class="ax-score-label" id="sc-' + c.id + '">' + esc(c.label) +
    '<button type="button" class="ax-info" aria-expanded="false" aria-controls="tip-' + c.id + '" aria-label="Cos\'è: ' + esc(c.label) + '"><span aria-hidden="true">?</span></button></h3>' +
    '<div class="ax-tip" role="tooltip" id="tip-' + c.id + '">' + esc(c.tip) + "</div>" +
    '<div class="ax-score-value">' + esc(c.value) + "</div>" +
    '<div class="ax-score-foot">' + deltaChip(c.delta, { unit: c.unit }) + '<span class="ax-card-meta">vs periodo prec.</span></div>' +
    sparkline(c.series, c.label) +
    "</article>"
  );
}

function bindTips() {
  const root = $("scorecards");
  if (root._tips) return;
  root._tips = true;
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".ax-info");
    root.querySelectorAll(".ax-info").forEach((b) => {
      const open = b === btn && b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      $(b.getAttribute("aria-controls")).classList.toggle("open", open);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") root.querySelectorAll(".ax-info[aria-expanded=true]").forEach((b) => b.click());
  });
}

// ---------- main chart ----------
function drawChart() {
  if (!current || typeof Chart === "undefined") return;
  const { stats, prev } = current;
  const groupBy = stats.period.groupBy;
  const ax = axis(stats.period, groupBy);
  const cur = values(stats, metric, ax, groupBy);
  const prevRange = stats.summary.prev_period;
  const prevOk = prev && !(prev.filters && prev.filters.clamped);
  const prevAx = prevOk ? axis({ from: prevRange.from, to: prevRange.to }, groupBy) : [];
  const prevVals = prevOk ? values(prev, metric, prevAx, groupBy) : [];

  const accent = token("--foglio-accent");
  const ink = token("--foglio-ink");
  const soft = token("--foglio-ink-soft");
  const mute = token("--foglio-ink-mute");
  const paper = token("--foglio-paper");
  const rule = token("--foglio-rule");
  const mono = "JetBrains Mono, monospace";
  const label = METRIC_LABEL[metric];

  if (chart) chart.destroy();
  chart = new Chart($("chart").getContext("2d"), {
    type: "line",
    data: {
      labels: ax.map((a) => a.label),
      datasets: [
        { label, data: cur, borderColor: accent, backgroundColor: withAlpha(accent, 0.14), fill: true, tension: 0.3, pointRadius: cur.length > 40 ? 0 : 3, pointHoverRadius: 6, pointBackgroundColor: accent, pointBorderColor: paper, pointBorderWidth: 2, borderWidth: 2.5, spanGaps: false },
        ...(prevOk ? [{ label: label + " · periodo prec.", data: ax.map((_, i) => (prevVals[i] == null ? null : prevVals[i])), borderColor: mute, backgroundColor: "transparent", borderDash: [6, 4], tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }] : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { labels: { color: soft, font: { family: mono, size: 11 }, usePointStyle: true, padding: 14 } },
        tooltip: {
          backgroundColor: paper, titleColor: ink, bodyColor: ink, borderColor: rule, borderWidth: 1, cornerRadius: 4, padding: 10,
          titleFont: { family: mono, size: 11, weight: "600" }, bodyFont: { family: mono, size: 11 },
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              return ax[i].key + (prevOk && prevAx[i] ? "  (prec. " + prevAx[i].key + ")" : "");
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: soft, font: { family: mono, size: 10 }, maxRotation: 0, maxTicksLimit: 8, autoSkip: true }, grid: { color: withAlpha(ink, 0.1), drawTicks: false } },
        y: { beginAtZero: true, ticks: { color: soft, font: { family: mono, size: 10 }, precision: 0, padding: 8 }, grid: { color: withAlpha(ink, 0.1), drawTicks: false }, border: { display: false } },
      },
    },
  });
  const total = cur.reduce((a, b) => a + (b || 0), 0);
  $("chart").setAttribute("aria-label", label + " nel periodo " + stats.period.from + " – " + stats.period.to + ": totale " + total + (prevOk ? ", con confronto col periodo precedente" : ""));
}

function syncMetricButtons() {
  const hourly = current && current.stats.period.groupBy === "hour";
  document.querySelectorAll("#metric-seg button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.metric === metric));
    const off = b.dataset.metric === "sessions" && (hourly || !current.stats.sessions.available);
    b.disabled = off;
    b.title = off ? "Le sessioni sono disponibili con granularità giornaliera" : "";
  });
}

// ---------- compact cards ----------
function compactCards(stats) {
  $("ov-top").innerHTML = barsHtml(
    (stats.top_pages || [])
      .slice()
      .sort((a, b) => (b.visitors || 0) - (a.visitors || 0) || (b.pageviews || 0) - (a.pageviews || 0))
      .slice(0, 5)
      .map((p) => ({ key: p.pathname, value: p.visitors })),
    { path: true, empty: "Nessuna pagina nel periodo" },
  );
  const se = stats.sessions;
  const ch = se.available ? se.by_channel.map((c) => ({ key: c.channel, value: c.sessions })) : (stats.channels || []).map((c) => ({ key: c.channel, value: c.visitors }));
  $("ov-channels").innerHTML = barsHtml(ch, { total: ch.reduce((a, b) => a + b.value, 0), empty: "Nessun canale nel periodo" });
  $("ov-countries").innerHTML = barsHtml(
    (stats.countries || []).slice(0, 8).map((c) => ({ key: countryName(c.country), prefix: flag(c.country) + " ", value: c.visitors })),
    { empty: "Nessun paese nel periodo" },
  );
  const dev = (stats.devices || []).map((d) => ({ key: deviceLabel(d.device_type), value: d.visitors }));
  $("ov-devices").innerHTML = barsHtml(dev, { total: dev.reduce((a, b) => a + b.value, 0), empty: "Nessun dispositivo nel periodo", tone: "info" });
}

export function renderOverview(data) {
  current = data;
  const stats = data.stats;
  $("scorecards").innerHTML = scorecards(stats).map(scoreHtml).join("");
  bindTips();
  syncMetricButtons();
  $("chart-state").innerHTML = "";
  drawChart();
  compactCards(stats);
  renderWorldMap(stats.countries);
}

/** The previous-period fetch finishes after the first paint: redraw the chart with the dashed series. */
export function updateOverviewPrev(data) {
  current = data;
  if (!$("panel-panoramica").hidden) drawChart();
}

export function initOverview() {
  $("metric-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-metric]");
    if (!b || b.disabled) return;
    metric = b.dataset.metric;
    syncMetricButtons();
    drawChart();
  });
}
export function onOverviewShown() {
  refreshMapSize();
  if (current) drawChart();
}
