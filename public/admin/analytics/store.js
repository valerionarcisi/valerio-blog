// Dashboard state: period, filters, "include unverified". One place, one change event.
import { shiftDay, todayStr } from "./lib.js";

export const PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

export const state = {
  period: "7d",
  from: null,
  to: null,
  includeAll: false,
  filters: { country: "", device: "", channel: "" },
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (why) => listeners.forEach((fn) => fn(why));

/** Concrete from/to (UTC days) for the current selection, used for display and /api/stats/sessions. */
function resolveRange() {
  if (state.period === "custom") return;
  const days = PERIOD_DAYS[state.period] || 7;
  state.to = todayStr();
  state.from = shiftDay(state.to, -(days - 1));
}

export function setPeriod(period) {
  state.period = period;
  resolveRange();
  emit("period");
}
export function setCustom(from, to) {
  if (!from || !to || from > to) return false;
  state.period = "custom";
  state.from = from;
  state.to = to > todayStr() ? todayStr() : to;
  emit("period");
  return true;
}
/** Moves the window by its own length (direction -1 / +1), never past today. */
export function shift(direction) {
  const days = state.period === "custom" ? Math.max(1, Math.round((Date.parse(state.to) - Date.parse(state.from)) / 86400000) + 1) : PERIOD_DAYS[state.period] || 7;
  let from = shiftDay(state.from, days * direction);
  let to = shiftDay(state.to, days * direction);
  if (to > todayStr()) {
    to = todayStr();
    from = shiftDay(to, -(days - 1));
  }
  state.period = "custom";
  state.from = from;
  state.to = to;
  emit("period");
}
export function setFilters(next) {
  Object.assign(state.filters, next);
  emit("filters");
}
export function setIncludeAll(on) {
  state.includeAll = !!on;
  emit("include");
}
export const filtersActive = () => !!(state.filters.country || state.filters.device || state.filters.channel);

export function filterQuery(overrides = {}) {
  const f = { ...state.filters, ...overrides };
  return ["country", "device", "channel"].filter((k) => f[k]).map((k) => "&" + k + "=" + encodeURIComponent(f[k])).join("");
}

/** /api/stats URL for the current selection (or for an explicit [from,to] with `range`). */
export function statsUrl(opts = {}) {
  const range = opts.range;
  const period = range ? "custom&from=" + range.from + "&to=" + range.to : state.period === "custom" ? "custom&from=" + state.from + "&to=" + state.to : state.period;
  return "/api/stats?period=" + period + (state.includeAll ? "&include=all" : "") + filterQuery(opts.filters || {});
}

resolveRange();
