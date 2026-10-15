import { verifyBearerToken } from "~/lib/auth";
import { env } from "~/lib/env";
import { readSessionCookie, verifySessionValue } from "~/lib/admin-session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** True when Origin (or, if absent, Referer) matches the request origin. */
export function isSameOrigin(request: Request): boolean {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}

export function hasAdminSession(request: Request): boolean {
  return verifySessionValue(readSessionCookie(request), env("ADMIN_TOKEN"));
}

/**
 * Authentication outcome: "bearer" (CSRF-exempt), "cookie", or null.
 * Cookie auth on state-changing methods additionally requires same-origin.
 */
export function adminAuth(request: Request): "bearer" | "cookie" | "forbidden" | null {
  if (verifyBearerToken(request, env("ADMIN_TOKEN"))) return "bearer";
  if (hasAdminSession(request)) {
    if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOrigin(request)) {
      return "forbidden";
    }
    return "cookie";
  }
  return null;
}

/** Cookie or Bearer. Returns 401/403 JSON response when not allowed, otherwise null. */
export function requireAdmin(request: Request): Response | null {
  const auth = adminAuth(request);
  if (auth === "bearer" || auth === "cookie") return null;
  const forbidden = auth === "forbidden";
  return new Response(JSON.stringify({ error: forbidden ? "Forbidden" : "Unauthorized" }), {
    status: forbidden ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  });
}
