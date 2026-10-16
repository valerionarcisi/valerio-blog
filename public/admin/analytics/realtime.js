// "In tempo reale": polls /api/stats/live every 30 s, paused while the tab is hidden.
import { $, apiJson, countryName, deviceIcon, esc, flag, relTime, stateEmpty, stateError, stateLoading, onRetry } from "./lib.js";

export const live = { active: null, sessions: [], error: null, loaded: false };
const listeners = new Set();
export const onLive = (fn) => listeners.add(fn);

export function userLabel(user) {
  return "Utente #" + user;
}

export function renderRealtime() {
  const box = $("rt-body");
  if (!box) return;
  if (!live.loaded) {
    box.innerHTML = live.error ? stateError(live.error) : stateLoading(3);
    return;
  }
  const rows = live.sessions;
  box.innerHTML =
    '<div class="ax-rt-count"><b>' + (Number(live.active) || 0) + '</b><span class="ax-muted">utenti online ora</span></div>' +
    (rows.length
      ? '<ul class="ax-rt-list" aria-label="Utenti online e pagina corrente">' +
        rows
          .map(
            (r) =>
              "<li><span title=\"" + esc(countryName(r.country)) + '">' + flag(r.country) + "</span>" +
              '<span class="p" title="' + esc(r.path || "") + '">' + deviceIcon(r.device) + " " + esc(r.path || "/") + "</span>" +
              '<span class="t">' + esc(userLabel(r.user)) + " · " + esc(relTime(r.last_seen_at)) + "</span></li>",
          )
          .join("") +
        "</ul>" +
        '<a class="ax-link" href="#utenti">Vedi tutti gli utenti</a>'
      : stateEmpty("Nessuno online in questo momento"));
}

export function loadLive() {
  return apiJson("/api/stats/live")
    .then((d) => {
      live.active = d.active;
      live.sessions = Array.isArray(d.active_sessions) ? d.active_sessions : [];
      live.error = null;
      live.loaded = true;
      $("live-count").textContent = String(Number(d.active) || 0);
    })
    .catch((e) => {
      live.error = e.message;
      console.error("loadLive failed", e);
    })
    .then(() => {
      renderRealtime();
      listeners.forEach((fn) => fn());
    });
}

export function initRealtime() {
  onRetry($("rt-body"), loadLive);
  const tick = () => {
    if (!document.hidden) loadLive();
  };
  setInterval(tick, 30000);
  document.addEventListener("visibilitychange", tick);
  loadLive();
}
