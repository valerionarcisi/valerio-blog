import { describe, test, expect, vi } from "vitest";

vi.mock("~/lib/env", () => ({ env: () => "admin-secret" }));

import { requireAdmin } from "./admin-auth";
import { createSessionValue } from "./admin-session";

const cookie = () => `vb_admin=${createSessionValue("admin-secret")}`;
const req = (auth?: string) =>
  new Request("https://example.com", auth ? { headers: { Authorization: auth } } : {});
const cookieReq = (method: string, extra: Record<string, string> = {}) =>
  new Request("https://example.com/api/admin/x", {
    method,
    headers: { Cookie: cookie(), ...extra },
  });

describe("requireAdmin", () => {
  test("returns null for a valid token", () => {
    expect(requireAdmin(req("Bearer admin-secret"))).toBeNull();
  });

  test("returns 401 JSON for a wrong token", async () => {
    const res = requireAdmin(req("Bearer nope"));
    expect(res?.status).toBe(401);
    expect(res?.headers.get("Content-Type")).toBe("application/json");
    expect(await res?.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 when the header is missing", () => {
    expect(requireAdmin(req())?.status).toBe(401);
  });

  test("cookie session allows GET", () => {
    expect(requireAdmin(cookieReq("GET"))).toBeNull();
  });

  test("cookie POST without Origin/Referer is 403", () => {
    expect(requireAdmin(cookieReq("POST"))?.status).toBe(403);
  });

  test("cookie POST with cross-origin Origin is 403", () => {
    expect(requireAdmin(cookieReq("POST", { Origin: "https://evil.example" }))?.status).toBe(403);
  });

  test("cookie POST with same-origin Origin or Referer is allowed", () => {
    expect(requireAdmin(cookieReq("POST", { Origin: "https://example.com" }))).toBeNull();
    expect(requireAdmin(cookieReq("DELETE", { Referer: "https://example.com/admin/x" }))).toBeNull();
  });

  test("Bearer POST is exempt from the origin check", () => {
    const r = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer admin-secret" },
    });
    expect(requireAdmin(r)).toBeNull();
  });

  test("invalid cookie is 401", () => {
    const r = new Request("https://example.com", { headers: { Cookie: "vb_admin=1.bad" } });
    expect(requireAdmin(r)?.status).toBe(401);
  });
});
