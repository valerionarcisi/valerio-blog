// Coinvolgimento: what people read and do.
import { $, barsHtml, esc, fmt, fmtDur, fmtPct, stateEmpty } from "./lib.js";

function topPagesTable(stats) {
  const rows = stats.top_pages || [];
  if (!rows.length) return stateEmpty("Nessuna pagina nel periodo");
  const eng = new Map((stats.top_engaged_posts || []).map((p) => [p.pathname, p]));
  return (
    '<div class="table-wrap"><table class="ax-table"><thead><tr><th scope="col">Pagina</th><th scope="col" class="num">Visualizzazioni</th><th scope="col" class="num">Utenti</th>' +
    '<th scope="col" class="num">Tempo attivo medio</th><th scope="col" class="num">Scroll medio</th></tr></thead><tbody>' +
    rows
      .map((p) => {
        const e = eng.get(p.pathname);
        return (
          '<tr><td class="path" title="' + esc(p.pathname) + '">' + esc(p.pathname) + '</td><td class="num">' + fmt(p.pageviews) + '</td><td class="num">' + fmt(p.visitors) + "</td>" +
          '<td class="num">' + (e ? esc(fmtDur(e.avg_time)) : "—") + '</td><td class="num">' + (e && e.avg_scroll != null ? e.avg_scroll + "%" : "—") + "</td></tr>"
        );
      })
      .join("") +
    "</tbody></table></div>"
  );
}

function engagedHtml(rows) {
  if (!rows || !rows.length) return stateEmpty("Nessun post con dati di engagement nel periodo");
  return (
    '<ul class="ax-bars">' +
    rows
      .map(
        (r) =>
          '<li><span class="k path" title="' + esc(r.pathname) + '">' + esc(r.pathname) + '</span><span class="v">' + fmt(r.pageviews) + " pv</span>" +
          '<span class="ax-card-meta" style="grid-column:1/-1">' + esc(fmtDur(r.avg_time)) + " attivi · scroll " + (r.avg_scroll == null ? "—" : r.avg_scroll + "%") + "</span></li>",
      )
      .join("") +
    "</ul>"
  );
}

function goalsHtml(goals) {
  if (!goals || !goals.length) return stateEmpty("Nessun obiettivo");
  return goals
    .map((g) => {
      const rows = (g.by_channel || []).map((c) => ({ key: c.channel, value: c.conversions }));
      const entries = (g.by_entry || []).slice(0, 3).map((c) => esc(c.path) + " (" + fmt(c.conversions) + ")").join(" · ");
      return (
        '<div class="ax-goal"><div class="ax-goal-head"><span>' + esc(g.label) + "</span><span><b>" + fmt(g.conversions) + "</b> · " + fmtPct(g.rate) + " delle sessioni</span></div>" +
        barsHtml(rows, { empty: "Nessuna conversione" }) +
        (entries ? '<p class="ax-card-meta" title="Pagine di ingresso con più conversioni">Da: ' + entries + "</p>" : "") +
        "</div>"
      );
    })
    .join("");
}

export function renderEngagement(stats) {
  const se = stats.sessions;
  $("en-pages").innerHTML = topPagesTable(stats);
  $("en-sections").innerHTML = barsHtml((stats.sections || []).map((r) => ({ key: r.section, value: r.visitors })), { empty: "Nessuna sezione nel periodo" });
  $("en-engaged").innerHTML = engagedHtml(stats.top_engaged_posts);
  const none = se.available ? "Nessuna sessione nel periodo" : "Sessioni non ancora attive: applica la migrazione Fase 2";
  $("en-entry").innerHTML = barsHtml((stats.entry_pages || []).map((r) => ({ key: r.path, value: r.sessions })), { path: true, empty: none });
  $("en-exit").innerHTML = barsHtml((stats.exit_pages || []).map((r) => ({ key: r.path, value: r.sessions })), { path: true, empty: none });
  $("en-events").innerHTML = barsHtml((stats.events || []).map((e) => ({ key: e.name + (e.prop ? " · " + e.prop : ""), value: e.count })), { empty: "Nessun evento nel periodo" });
  $("en-goals").innerHTML = goalsHtml(stats.goals);
}
