// Bot & qualità: verdict counts, "Da rivedere", rules, and the LEGACY per-hash flag tools
// (kept, labelled legacy, until the removal procedure in docs/analytics-spec.md).
import {
  $, apiFetch, countryName, deviceIcon, esc, flag, fmt, fmtDur, JSON_HEADERS, stateEmpty, verdictBadge,
} from "./lib.js";
import { mountRuleForm, suggestFromReview } from "./rules.js";
import { setIncludeAll } from "./store.js";

let review = [];
let recent = [];

const zeroEngagement = (v) => v.visitor_hash && (v.time_on_page == null || Number(v.time_on_page) <= 5) && (v.scroll_depth == null || Number(v.scroll_depth) === 0);

function qualityCards(stats) {
  const q = stats.quality || { human: 0, unverified: 0, bot: 0, unverified_pct: 0 };
  const card = (cls, label, value, foot) =>
    '<article class="ax-score ' + cls + '"><h3 class="ax-score-label">' + label + '</h3><div class="ax-score-value">' + fmt(value) + "</div>" + (foot ? '<div class="ax-score-foot"><span class="ax-card-meta">' + foot + "</span></div>" : "") + "</article>";
  $("quality").innerHTML =
    card("human", "Umani", q.human, "visite uniche") + card("unverified", "Non verificati", q.unverified, esc(q.unverified_pct) + "% dei non-bot") + card("bot", "Bot", q.bot, "visite uniche");
  $("q-mode").textContent = stats.mode === "all" ? "Numeri principali: tutte le visite non flaggate (come prima)" : "Numeri principali: solo visite umane";
  const sl = stats.summary_legacy;
  $("q-legacy").textContent = sl ? "Numeri vecchi: " + fmt(sl.pageviews) + " pageviews · " + fmt(sl.visitors) + " visitatori" : "";
  $("include-all").checked = stats.mode === "all";
}

function reviewHtml(rows) {
  if (!rows.length) return stateEmpty("Niente da rivedere nel periodo");
  return (
    '<ul class="ax-card-list" id="review-list">' +
    rows
      .map((r, i) => {
        const parts = [deviceIcon(r.device_type) + " " + esc(r.browser || "?") + " / " + esc(r.os || "?")];
        if (r.referrer) parts.push("da " + esc(r.referrer));
        if (Number(r.max_score) > 0) parts.push("score " + Number(r.max_score));
        return (
          '<li data-i="' + i + '"><div class="ax-row"><span class="grow">' + flag(r.country) + " " + esc(r.path_pattern || "/") + '<span class="ax-sub">' + parts.join(" · ") + "</span></span>" +
          "<span>" + fmt(r.pageviews) + " pv · " + fmt(r.visits) + ' visite</span><button type="button" class="ax-btn" data-act="rule">Crea regola</button></div></li>'
        );
      })
      .join("") +
    "</ul>"
  );
}

// ---- legacy ----
function recentHtml(rows) {
  if (!rows.length) return stateEmpty("Nessun visitatore recente");
  return (
    '<ul class="ax-recent">' +
    rows
      .map((v) => {
        const meta = [deviceIcon(v.device_type) + " " + esc(v.browser || "?") + " / " + esc(v.os || "?")];
        if (v.referrer) meta.push("da " + esc(v.referrer));
        if (v.time_on_page != null) meta.push("⏱ " + fmtDur(v.time_on_page));
        if (v.scroll_depth != null) meta.push("↓ " + Number(v.scroll_depth) + "%");
        const hash = v.visitor_hash || "";
        return (
          '<li class="' + (zeroEngagement(v) ? "suspect" : "") + '"><span title="' + esc(countryName(v.country)) + '">' + flag(v.country) + "</span>" +
          '<span class="pg">' + esc(v.pathname || "/") + "<small>" + meta.join(" · ") + "</small></span>" +
          "<span>" + verdictBadge(v.verdict) + "</span>" +
          (hash ? '<button type="button" class="ax-btn legacy" data-hash="' + esc(hash) + '" title="Flag come bot (legacy: flag per hash, sostituito dalle regole bot)">Flag (legacy)</button>' : "") +
          "</li>"
        );
      })
      .join("") +
    "</ul>"
  );
}

function legacyPanel(stats) {
  recent = stats.recent_visitors || [];
  const suspectN = stats.suspicious ? stats.suspicious.count : 0;
  $("s-suspects").textContent = fmt(suspectN);
  const flagBtn = $("flag-suspects-btn");
  flagBtn.hidden = suspectN === 0;
  flagBtn.disabled = false;
  flagBtn.textContent = "Flag come bot (" + suspectN + ") (legacy)";
  const zero = recent.filter(zeroEngagement).length;
  const bulk = $("flag-all-bots");
  bulk.hidden = zero === 0;
  bulk.disabled = false;
  bulk.textContent = "Flag zero-engagement (" + zero + ") (legacy)";
  $("recent-box").innerHTML = recentHtml(recent);
}

export function renderQuality(stats) {
  qualityCards(stats);
  review = stats.review || [];
  $("review-box").innerHTML = reviewHtml(review);
  legacyPanel(stats);
}

function legacyPost(method, body, btn, busy, done, reload) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = busy;
  return apiFetch("/api/admin/bot", { method, headers: JSON_HEADERS, body: JSON.stringify(body) })
    .then((r) => r.json())
    .then((d) => {
      btn.textContent = done(d);
      setTimeout(() => {
        btn.textContent = orig;
        btn.disabled = false;
      }, 2500);
      if (reload) setTimeout(reload, 800);
    })
    .catch((e) => {
      console.error("legacy bot action failed", e);
      btn.disabled = false;
      btn.textContent = "Errore";
      setTimeout(() => (btn.textContent = orig), 2500);
    });
}

export function initQuality({ reload, range }) {
  $("include-all").addEventListener("change", (e) => setIncludeAll(e.target.checked));
  $("review-box").addEventListener("click", (ev) => {
    const btn = ev.target.closest('button[data-act="rule"]');
    if (!btn) return;
    const li = btn.closest("li");
    mountRuleForm(li, suggestFromReview(review[Number(li.dataset.i)]));
  });

  $("recent-box").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-hash]");
    if (!btn) return;
    const li = btn.closest("li");
    const flagged = li.classList.contains("flagged");
    btn.disabled = true;
    apiFetch("/api/admin/bot", { method: flagged ? "DELETE" : "POST", headers: JSON_HEADERS, body: JSON.stringify({ hash: btn.dataset.hash }) })
      .then(() => {
        li.classList.toggle("flagged", !flagged);
        btn.textContent = flagged ? "Flag (legacy)" : "Annulla (legacy)";
      })
      .catch((e) => console.error("legacy flag failed", e))
      .then(() => (btn.disabled = false));
  });

  $("flag-all-bots").addEventListener("click", () => {
    const hashes = recent.filter(zeroEngagement).map((v) => v.visitor_hash);
    if (hashes.length) legacyPost("POST", { hashes }, $("flag-all-bots"), "Flagging…", (d) => d.flagged + " flaggati", null);
  });
  $("flag-suspects-btn").addEventListener("click", () => {
    const r = range();
    if (r.from && r.to) legacyPost("POST", { flagSuspicious: true, from: r.from, to: r.to }, $("flag-suspects-btn"), "Flagging…", (d) => d.flagged + " flaggati", reload);
  });
  $("unflag-recent").addEventListener("click", () => legacyPost("DELETE", { recentMinutes: 1440 }, $("unflag-recent"), "Annullamento…", (d) => (d.unflagged > 0 ? d.unflagged + " annullati" : "Nessuno da annullare"), reload));
  $("unflag-all").addEventListener("click", () => {
    if (!confirm("Rimuovere TUTTI gli hash flaggati come bot? L'azione ricalcolerà is_unique per ogni hash.")) return;
    legacyPost("DELETE", { all: true }, $("unflag-all"), "Annullamento…", (d) => (d.unflagged > 0 ? d.unflagged + " annullati" : "Nessuno da annullare"), reload);
  });
}
