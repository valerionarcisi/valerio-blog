import { describe, test, expect, vi } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));
vi.mock("~/lib/env", () => ({
  env: (k: string) => (k === "ADMIN_TOKEN" ? "the-admin-token" : ""),
}));

const { onRequest } = (await import("~/middleware")) as unknown as {
  onRequest: (
    ctx: Record<string, unknown>,
    next: () => Promise<Response>,
  ) => Promise<Response>;
};

function run(
  url: string,
  opts: { method?: string; headers?: Record<string, string> } = {},
) {
  const request = new Request(url, {
    method: opts.method ?? "GET",
    headers: opts.headers,
  });
  const locals: Record<string, unknown> = {};
  const nextCalls = { n: 0 };
  const ctx = { url: new URL(url), request, locals, isPrerendered: false };
  const next = async () => {
    nextCalls.n++;
    return new Response("<html>page</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };
  return onRequest(ctx, next).then((res) => ({ res, locals, nextCalls }));
}

const TOKEN_URL = "https://valerionarcisi.me/admin/analytics?token=the-admin-token";

describe("admin middleware: token exchange", () => {
  test("a valid ?token= renders the page and sets the session cookie; it never redirects", async () => {
    const { res, locals, nextCalls } = await run(TOKEN_URL);
    // Netlify re-appends the query string to any redirect Location, so a redirect loops forever
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(nextCalls.n).toBe(1);
    expect(locals.isAdmin).toBe(true);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("vb_admin=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  test("no Secure flag on plain http (local dev)", async () => {
    const { res } = await run("http://localhost:4321/admin?token=the-admin-token");
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });

  test("the cookie from the exchange authenticates later requests without the token", async () => {
    const first = await run(TOKEN_URL);
    const cookie = (first.res.headers.get("set-cookie") ?? "").split(";")[0];
    const second = await run("https://valerionarcisi.me/admin/analytics", {
      headers: { cookie },
    });
    expect(second.locals.isAdmin).toBe(true);
    expect(second.res.headers.get("set-cookie")).toBeNull();
  });

  test("wrong token: not admin, no cookie, no redirect", async () => {
    const { res, locals } = await run(
      "https://valerionarcisi.me/admin/analytics?token=nope",
    );
    expect(locals.isAdmin).toBe(false);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  test("a token on a non-admin path is ignored", async () => {
    const { res, locals } = await run(
      "https://valerionarcisi.me/blog?token=the-admin-token",
    );
    expect(locals.isAdmin).toBe(false);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("a token on a POST does not set a cookie", async () => {
    const { res } = await run(TOKEN_URL, { method: "POST" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("admin responses are never cached or indexed", async () => {
    const { res } = await run(TOKEN_URL);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
