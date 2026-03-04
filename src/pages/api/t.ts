import type { APIRoute } from "astro";
import getDb from "~/lib/turso";
import { generateVisitorHash, isBot } from "~/lib/analytics";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const ua = request.headers.get("user-agent") ?? undefined;
  if (isBot(ua)) {
    return new Response(null, { status: 204 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const hostname = "valerionarcisi.me";

  try {
    const hash = await generateVisitorHash(hostname, ip, ua ?? "");
    await getDb().execute({
      sql: "INSERT OR IGNORE INTO bot_hashes (hash) VALUES (?)",
      args: [hash],
    });
  } catch {
    // best-effort
  }

  return new Response(null, { status: 204 });
};
