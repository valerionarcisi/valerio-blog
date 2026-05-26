import type { APIRoute } from "astro";

// Bot-trap endpoint deprecated — kept as a 204 no-op so existing links don't 404.
// Bot detection is now handled by `isBot()` (UA-based) on `/api/e`.
export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(null, { status: 204 });
};
