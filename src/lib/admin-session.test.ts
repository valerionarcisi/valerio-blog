import { describe, test, expect } from "vitest";
import {
  createSessionValue,
  verifySessionValue,
  sessionCookieHeader,
  clearCookieHeader,
  SESSION_TTL_SECONDS,
} from "./admin-session";

const NOW = 1_800_000_000_000;

describe("admin session", () => {
  test("valid session verifies", () => {
    const v = createSessionValue("s3cret", NOW);
    expect(verifySessionValue(v, "s3cret", NOW + 1000)).toBe(true);
  });
  test("expired session is rejected", () => {
    const v = createSessionValue("s3cret", NOW);
    expect(verifySessionValue(v, "s3cret", NOW + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });
  test("tampered expiry or signature is rejected", () => {
    const v = createSessionValue("s3cret", NOW);
    const [exp, sig] = v.split(".");
    expect(verifySessionValue(`${Number(exp) + 100000}.${sig}`, "s3cret", NOW)).toBe(false);
    expect(verifySessionValue(`${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, "s3cret", NOW)).toBe(false);
  });
  test("wrong secret is rejected", () => {
    expect(verifySessionValue(createSessionValue("a", NOW), "b", NOW)).toBe(false);
  });
  test("empty secret fails closed", () => {
    expect(() => createSessionValue("", NOW)).toThrow();
    expect(verifySessionValue(createSessionValue("a", NOW), "", NOW)).toBe(false);
  });
  test("malformed values are rejected", () => {
    for (const bad of ["", "abc", "123.", ".abc", "1.2.3", null, undefined]) {
      expect(verifySessionValue(bad as never, "s3cret", NOW)).toBe(false);
    }
  });
  test("cookie headers", () => {
    const h = sessionCookieHeader("x.y", { secure: false });
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Strict");
    expect(h).toContain("Max-Age=2592000");
    expect(h).not.toContain("Secure");
    expect(sessionCookieHeader("x.y", { secure: true })).toContain("; Secure");
    expect(clearCookieHeader()).toContain("Max-Age=0");
  });
});
