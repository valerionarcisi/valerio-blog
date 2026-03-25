import type { APIRoute } from "astro";
import { sendContactEmail } from "~/lib/email";
import {
  type Result,
  ok,
  err,
  jsonOk,
  jsonErr,
  isNonEmptyString,
  isValidEmail,
  parseJsonBody,
} from "~/lib/result";

export const prerender = false;

const ALLOWED_ORIGINS = [
  "https://valerionarcisi.me",
  "https://www.valerionarcisi.me",
  "http://localhost:4321",
  "http://localhost:3000",
];

const rateLimit = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  rateLimit.set(ip, recent);
  if (recent.length >= RATE_MAX_REQUESTS) return true;
  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

interface ContactInput {
  name: string;
  email: string;
  message: string;
}

function parseContactInput(body: unknown): Result<ContactInput | "honeypot"> {
  if (!body || typeof body !== "object") return err("Invalid body");
  const { name, email, message, website } = body as Record<string, unknown>;

  if (website) return ok("honeypot" as const);

  if (!isNonEmptyString(name) || name.length > 100) return err("Invalid name");
  if (!isValidEmail(email)) return err("Invalid email");
  if (!isNonEmptyString(message) || message.length > 5000)
    return err("Message too long");

  return ok({
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return jsonErr("Forbidden", 403);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(ip)) return jsonErr("Too many requests", 429);

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return jsonErr(bodyResult.error, 400);

  const parsed = parseContactInput(bodyResult.value);
  if (!parsed.ok) return jsonErr(parsed.error, 400);
  if (parsed.value === "honeypot") return jsonOk({ ok: true });

  const sent = await sendContactEmail(parsed.value);
  if (!sent) return jsonErr("Failed to send", 500);

  return jsonOk({ ok: true });
};
