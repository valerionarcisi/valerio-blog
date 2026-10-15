import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";

/** Returns the standard 401 response when the request is not authorized, otherwise null. */
export function requireAdmin(request: Request): Response | null {
  if (verifyBearerToken(request, env("ADMIN_TOKEN"))) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
