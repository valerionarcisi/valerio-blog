import type { APIRoute } from "astro";
import { sendContactEmail } from "~/lib/email";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  rateLimit.set(ip, recent);

  if (recent.length >= RATE_MAX_REQUESTS) return true;

  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { name, email, message, website } = body;

  if (website) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "All fields are required" }), { status: 400 });
  }

  if (typeof name !== "string" || name.length > 100) {
    return new Response(JSON.stringify({ error: "Invalid name" }), { status: 400 });
  }

  if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
  }

  if (typeof message !== "string" || message.length > 5000) {
    return new Response(JSON.stringify({ error: "Message too long" }), { status: 400 });
  }

  const sent = await sendContactEmail({ name: name.trim(), email: email.trim(), message: message.trim() });

  if (!sent) {
    return new Response(JSON.stringify({ error: "Failed to send" }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
