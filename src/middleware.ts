import { defineMiddleware } from "astro:middleware";

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

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!isAdminPath(context.url.pathname)) return response;

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
