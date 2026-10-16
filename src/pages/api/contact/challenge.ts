import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { env } from "~/lib/env";
import { makeChallenge, POW_BITS } from "~/lib/contact";
import { checkRate, rateKey } from "~/lib/rate-limit";
import { jsonErr } from "~/lib/result";

export const prerender = false;

// Fetched by the browser when the visitor first touches the form, never on page load.
export const GET: APIRoute = async ({ request }) => {
  const secret = env("ADMIN_TOKEN");
  if (!secret) return jsonErr("not_configured", 503);
  if (!(await checkRate(getDb(), `${rateKey(request, "contact-challenge")}:1h`, 60, 3600)))
    return jsonErr("rate_limited", 429);

  return new Response(JSON.stringify({ challenge: makeChallenge(secret), bits: POW_BITS }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
