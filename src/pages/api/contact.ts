import type { APIRoute } from "astro";
import { sendContactEmail } from "~/lib/email";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
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
