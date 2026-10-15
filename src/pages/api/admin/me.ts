import type { APIRoute } from "astro";
import { requireAdmin } from "~/lib/admin-auth";

export const prerender = false;

// Used by the public comment form to detect author mode. Never cacheable.
export const GET: APIRoute = ({ request }) => {
  const denied = requireAdmin(request);
  const res = denied ?? new Response(JSON.stringify({ admin: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};
