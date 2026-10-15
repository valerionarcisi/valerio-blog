import { describe, test, expect, vi } from "vitest";

vi.mock("~/lib/env", () => ({ env: () => "admin-secret" }));

import { requireAdmin } from "./admin-auth";

const req = (auth?: string) =>
  new Request("https://example.com", auth ? { headers: { Authorization: auth } } : {});

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
});
