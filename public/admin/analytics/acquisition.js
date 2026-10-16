// Acquisizione: where visitors come from.
import { $, apiJson, barsHtml, stateEmpty, stateError, stateLoading, onRetry } from "./lib.js";
import { statsUrl } from "./store.js";

function entryRows(pages) {
  return (pages || []).map((p) => ({ key: p.path, value: p.sessions }));
}

export function renderAcquisition(stats) {
  const se = stats.sessions;
  const ch = se.available ? se.by_channel.map((c) => ({ key: c.channel, value: c.sessions })) : (stats.channels || []).map((c) => ({ key: c.channel, value: c.visitors }));
  const total = ch.reduce((a, b) => a + b.value, 0);
  $("aq-channels").innerHTML = ch.length
    ? barsHtml(ch, { total, empty: "Nessun canale nel periodo" }) +
      '<p class="ax-card-meta" style="margin-top:.6rem">' + (se.available ? "Sessioni per canale di provenienza" : "Utenti per canale (sessioni non attive)") + ". Il trend nel tempo è nel grafico della Panoramica con il filtro Canale.</p>"
    : stateEmpty("Nessun canale nel periodo");
  $("aq-referrers").innerHTML = barsHtml((stats.referrers || []).map((r) => ({ key: r.referrer, value: r.visitors })), { empty: "Solo traffico diretto" });
  $("aq-utm-sources").innerHTML = barsHtml((stats.utm_sources || []).map((r) => ({ key: r.utm_source, value: r.visitors })), { empty: "Nessuna UTM nel periodo" });
  $("aq-utm-campaigns").innerHTML = barsHtml((stats.utm_campaigns || []).map((r) => ({ key: r.utm_campaign, value: r.visitors })), { empty: "Nessuna campagna nel periodo" });
  loadLanding(stats);
}

let landingSeq = 0;
let lastStats = null;
function loadLanding(stats) {
  lastStats = stats || lastStats;
  const box = $("aq-landing");
  const channel = $("landing-channel").value;
  const unit = (rows) => '<p class="ax-card-meta" style="margin:0 0 .5rem">sessioni che iniziano su questa pagina</p>' + barsHtml(rows, { path: true, empty: "Nessuna sessione nel periodo" });
  if (!channel) {
    box.innerHTML = unit(entryRows(lastStats.entry_pages));
    return;
  }
  const seq = ++landingSeq;
  box.innerHTML = stateLoading(3);
  const run = () =>
    apiJson(statsUrl({ filters: { channel } }))
      .then((d) => {
        if (seq === landingSeq) box.innerHTML = unit(entryRows(d.entry_pages));
      })
      .catch((e) => {
        if (seq === landingSeq) box.innerHTML = stateError(e.message);
      });
  onRetry(box, run);
  run();
}

export function initAcquisition() {
  $("landing-channel").addEventListener("change", () => lastStats && loadLanding());
}
