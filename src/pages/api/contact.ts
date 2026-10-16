import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { env } from "~/lib/env";
import { sendContactEmail } from "~/lib/email";
import { checkRate, rateKey } from "~/lib/rate-limit";
import { claimChallenge, parseContactInput, verifyChallenge } from "~/lib/contact";
import { jsonErr, jsonOk, parseJsonBody } from "~/lib/result";

export const prerender = false;

const SITE_ORIGINS = new Set([
  "https://valerionarcisi.me",
  "https://www.valerionarcisi.me",
  "http://localhost:4321",
  "http://localhost:3000",
]);
const MAX_BODY_BYTES = 20_000;

/** Same-site only: a browser form on our pages always sends Origin (or at least Referer). */
function isSameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) return SITE_ORIGINS.has(origin);
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return SITE_ORIGINS.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameSite(request)) return jsonErr("Forbidden", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return jsonErr("Payload too large", 413);
  if (!env("RESEND_API_KEY")) return jsonErr("not_configured", 503);

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);
  const body = bodyResult.value as Record<string, unknown>;

  const parsed = parseContactInput(body);
  if (!parsed.ok) return jsonErr(parsed.error, 400);
  if (parsed.value === "honeypot") return jsonOk({ ok: true });
  if (parsed.value === "spam") return jsonErr("spam", 422);

  // Cheap, stateless checks first: signature, expiry, proof of work.
  const secret = env("ADMIN_TOKEN");
  const pow = verifyChallenge(secret, body.challenge, body.nonce);
  if (!pow.ok) return jsonErr(pow.error === "Challenge expired" ? "expired" : "challenge", 400);

  const db = getDb();
  // 3 per 10 minutes and 8 per day for one visitor, 40 per day for the whole site (flood / mailbox protection).
  const key = rateKey(request, "contact");
  if (
    !(await checkRate(db, `${key}:10m`, 3, 600)) ||
    !(await checkRate(db, `${key}:1d`, 8, 86_400)) ||
    !(await checkRate(db, "contact:global:1d", 40, 86_400))
  ) {
    return jsonErr("rate_limited", 429);
  }

  if (!(await claimChallenge(db, pow.value.id))) return jsonErr("challenge", 400);

  const sent = await sendContactEmail(parsed.value);
  if (!sent) return jsonErr("send_failed", 502);

  return jsonOk({ ok: true });
};
