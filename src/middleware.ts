import { defineMiddleware } from "astro:middleware";
import { env } from "~/lib/env";
import { timeSafeEqual, verifyBearerToken } from "~/lib/auth";
import {
  createSessionValue,
  sessionCookieHeader,
  verifySessionValue,
  readSessionCookie,
} from "~/lib/admin-session";

// CSP intentionally omitted: admin pages rely on inline scripts plus CDN assets
// (jsdelivr, cartocdn, world-atlas, fonts); a safe policy needs nonces/testing.
function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

function isAdminPage(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) {
    context.locals.isAdmin = false;
    return next();
  }
  const { url, request } = context;
  const secret = env("ADMIN_TOKEN");
  const queryToken = url.searchParams.get("token") ?? "";
  const validQueryToken =
    isAdminPage(url.pathname) && queryToken.length > 0 && timeSafeEqual(queryToken, secret);

  context.locals.isAdmin =
    verifySessionValue(readSessionCookie(request), secret) ||
    verifyBearerToken(request, secret) ||
    validQueryToken;

  let response: Response;
  if (validQueryToken && (request.method === "GET" || request.method === "HEAD")) {
    // Exchange the one-time ?token= for a session cookie and strip it from the URL.
    const clean = new URL(url);
    clean.searchParams.delete("token");
    response = new Response(null, {
      status: 302,
      headers: {
        Location: clean.pathname + clean.search + clean.hash,
        "Set-Cookie": sessionCookieHeader(createSessionValue(secret), {
          secure: url.protocol === "https:",
        }),
      },
    });
  } else {
    response = await next();
  }
  if (!isAdminPath(url.pathname)) return response;

  const apply = (headers: Headers) => {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Content-Type-Options", "nosniff");
  };

  try {
    apply(response.headers);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    apply(copy.headers);
    return copy;
  }
});
