import type { EventName } from "./analytics-events";

/**
 * Goals = a custom event, optionally restricted to the path of the event.
 * Conversions are DISTINCT SESSIONS that fired the event (anywhere in the
 * session); the rate is conversions / sessions of the same scope.
 * Changing this list changes future rollups only: past days keep what was
 * computed when they were rolled up (re-run the rollup to recompute).
 */
export interface Goal {
  id: string;
  label: string;
  event: EventName;
  /** event.path must start with one of these (omit = any page). */
  pathPrefixes?: string[];
}

export const GOALS: Goal[] = [
  { id: "contact", label: "Contatto", event: "contact_submit" },
  { id: "comment", label: "Commento", event: "comment_submit" },
  {
    id: "engaged_read",
    label: "Lettura (75%)",
    event: "scroll_75",
    pathPrefixes: ["/blog/", "/en/blog/"],
  },
  { id: "outbound", label: "Click in uscita", event: "outbound_click" },
];

/** Pseudo goal stored in daily_goals: sessions per channel / entry page (rate denominators). */
export const SESSIONS_GOAL_ID = "_sessions";
