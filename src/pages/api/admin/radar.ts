import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";
import radar from "~/data/radar.json";

export const prerender = false;

// Radar data contains personal fit scores: served only to the admin.
// Source of truth lives in src/data/radar.json (updated by the weekly workflow).
export const GET: APIRoute = async ({ request }) => {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return new Response(JSON.stringify(radar), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
