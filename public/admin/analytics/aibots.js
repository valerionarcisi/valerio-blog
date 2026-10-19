// "Bot AI" tab: its own feed (/api/stats/ai-bots), not part of the /api/stats payload.
import { $, apiJson, barsHtml, esc, fmt, fmtDayShort, stateEmpty, stateError, stateLoading } from "./lib.js";
import { state } from "./store.js";

const KIND = { training: "addestramento", search: "ricerca", user: "utente" };
const BOXES = ["ai-bots", "ai-human", "ai-pages", "ai-daily"];
let dirty = true;
let seq = 0;

export const markAiBotsDirty = () => (dirty = true);

export function showAiBots() {
  if (!dirty) return;
  dirty = false;
  const mine = ++seq;
  BOXES.forEach((id) => ($(id).innerHTML = stateLoading(3)));
  apiJson("/api/stats/ai-bots?from=" + state.from + "&to=" + state.to)
    .then((d) => {
      if (mine === seq) render(d);
    })
    .catch((e) => {
      if (mine !== seq) return;
      dirty = true;
      BOXES.forEach((id) => ($(id).innerHTML = stateError(e.message)));
    });
}

function render(d) {
  const noCrawls = d.available ? "Nessun bot AI nel periodo" : "Ancora nessun bot AI registrato (la tabella nasce alla prima visita di un crawler)";
  $("ai-total").textContent = fmt(d.total) + " richieste";
  $("ai-bots").innerHTML = barsHtml(
    d.by_bot.map((b) => ({ key: b.bot + " · " + b.vendor + " · " + (KIND[b.kind] || b.kind), value: b.hits })),
    { empty: noCrawls, total: d.total },
  );
  $("ai-pages").innerHTML = d.by_page.length
    ? '<div class="table-wrap"><table class="ax-table"><thead><tr><th scope="col">Pagina</th><th scope="col" class="num">Richieste</th><th scope="col">Bot</th></tr></thead><tbody>' +
      d.by_page
        .map((p) => '<tr><td class="path" style="max-width: 14rem" title="' + esc(p.pathname) + '">' + esc(p.pathname) + '</td><td class="num">' + fmt(p.hits) + '</td><td style="white-space: normal">' + esc(p.bots.join(", ")) + "</td></tr>")
        .join("") +
      "</tbody></table></div>"
    : stateEmpty(noCrawls);
  $("ai-daily").innerHTML = barsHtml(
    d.daily.map((x) => ({ key: fmtDayShort(x.day), value: x.hits })),
    { empty: noCrawls },
  );

  const h = d.human;
  $("ai-human-total").textContent = fmt(h.sessions) + ' sessioni umane, canale "ai"';
  $("ai-human").innerHTML = !h.available
    ? stateEmpty("Sessioni non disponibili")
    : h.sessions === 0
      ? stateEmpty("Nessuno è arrivato da ChatGPT, Claude, Perplexity o simili nel periodo")
      : barsHtml(h.by_source.map((s) => ({ key: s.source, value: s.sessions })), { total: h.sessions }) +
        '<h3 class="ax-card-title" style="margin: 1rem 0 0.5rem">Pagine di ingresso</h3>' +
        barsHtml(h.by_page.map((p) => ({ key: p.pathname, value: p.sessions })), { path: true });
}
