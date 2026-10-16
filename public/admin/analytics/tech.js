// Tecnologia: device, browser, OS, language, Web Vitals, slowest pages.
import { $, barsHtml, deviceLabel, esc, fmt, stateEmpty } from "./lib.js";

const LABELS = { lcp: "LCP", inp: "INP", cls: "CLS" };
const HINT = { lcp: "Largest Contentful Paint: quando compare il contenuto principale", inp: "Interaction to Next Paint: reattività a tocchi e click", cls: "Cumulative Layout Shift: quanto salta il layout" };
const STATE_TXT = { good: "Buono", ni: "Da migliorare", poor: "Scarso" };

function vitalCard(metric, v, byDev) {
  v = v || { n: 0, good: 0, ni: 0, poor: 0, p75: null };
  const st = v.n > 0 ? window.vitalState(metric, v.p75) : null;
  const tot = v.good + v.ni + v.poor;
  const pc = (x) => (tot > 0 ? Math.round((x / tot) * 100) : 0);
  const dev = ["mobile", "desktop"]
    .map((dn) => {
      const x = byDev && byDev[dn] ? byDev[dn][metric] : null;
      if (!x || !x.n) return "<span>" + esc(dn) + " <b>—</b></span>";
      return "<span>" + esc(dn) + ' <b class="' + esc(window.vitalState(metric, x.p75) || "") + '">' + esc(window.fmtVital(metric, x.p75)) + "</b> (" + fmt(x.n) + ")</span>";
    })
    .join(" · ");
  return (
    '<article class="ax-score ax-vital" title="' + esc(HINT[metric]) + '">' +
    '<h3 class="ax-score-label">' + esc(LABELS[metric]) + " · p75</h3>" +
    '<div class="ax-score-value ' + (st || "") + '">' + esc(v.n > 0 ? window.fmtVital(metric, v.p75) : "—") + "</div>" +
    '<p class="ax-vital-state">' + esc(st ? STATE_TXT[st] : "Nessun dato") + " · " + fmt(v.n) + " misure</p>" +
    '<div class="ax-vital-split" role="img" aria-label="' + esc("Buono " + pc(v.good) + "%, da migliorare " + pc(v.ni) + "%, scarso " + pc(v.poor) + "%") + '">' +
    '<span class="g" style="width:' + pc(v.good) + '%"></span><span class="n" style="width:' + pc(v.ni) + '%"></span><span class="p" style="width:' + pc(v.poor) + '%"></span></div>' +
    '<p class="ax-vital-meta">buono ' + pc(v.good) + "% · da migliorare " + pc(v.ni) + "% · scarso " + pc(v.poor) + "%</p>" +
    '<p class="ax-vital-meta">' + dev + "</p></article>"
  );
}

export function renderTech(stats) {
  $("te-devices").innerHTML = barsHtml((stats.devices || []).map((d) => ({ key: deviceLabel(d.device_type), value: d.visitors })), { empty: "Nessun dato nel periodo", tone: "info" });
  $("te-browsers").innerHTML = barsHtml((stats.browsers || []).map((d) => ({ key: d.browser, value: d.visitors })), { empty: "Nessun dato nel periodo" });
  $("te-os").innerHTML = barsHtml((stats.os || []).map((d) => ({ key: d.os, value: d.visitors })), { empty: "Nessun dato nel periodo" });
  $("te-languages").innerHTML = barsHtml((stats.languages || []).map((d) => ({ key: d.lang, value: d.visitors })), { empty: "Nessun dato nel periodo" });

  const v = stats.vitals || {};
  const off = v.available === false;
  $("vitals-state").innerHTML = off ? stateEmpty("Web Vitals non ancora attivi: applica la migrazione Fase 5.") : "";
  $("vitals-cards").innerHTML = off ? "" : ["lcp", "inp", "cls"].map((m) => vitalCard(m, v[m], v.by_device)).join("");

  const rows = stats.vitals_pages || [];
  $("te-slow").innerHTML = rows.length
    ? '<ul class="ax-bars">' +
      rows
        .map((r) => {
          const st = window.vitalState("lcp", r.lcp_p75) || "";
          return '<li><span class="k path" title="' + esc(r.pathname) + '">' + esc(r.pathname) + '</span><span class="v"><b class="' + esc(st) + '">' + esc(window.fmtVital("lcp", r.lcp_p75)) + "</b><small>" + fmt(r.n) + " misure</small></span></li>";
        })
        .join("") +
      "</ul>"
    : stateEmpty("Nessuna pagina con almeno 5 misure LCP");
}
