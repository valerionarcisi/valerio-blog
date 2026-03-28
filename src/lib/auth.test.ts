import { describe, test, expect, vi, afterEach } from "vitest";
import { timeSafeEqual, verifyBearerToken, verifyAdminToken, verifyAdminBearerToken } from "./auth";

describe("timeSafeEqual", () => {
  test("equal strings return true", () => {
    expect(timeSafeEqual("secret123", "secret123")).toBe(true);
  });

  test("different strings return false", () => {
    expect(timeSafeEqual("secret123", "secret456")).toBe(false);
  });

  test("different lengths return false", () => {
    expect(timeSafeEqual("short", "longer-string")).toBe(false);
  });

  test("empty strings return false", () => {
    expect(timeSafeEqual("", "")).toBe(false);
  });

  test("undefined input returns false", () => {
    expect(timeSafeEqual("token", undefined as unknown as string)).toBe(false);
    expect(timeSafeEqual(undefined as unknown as string, "token")).toBe(false);
  });
});

describe("verifyBearerToken", () => {
  function makeRequest(authHeader?: string): Request {
    const headers = new Headers();
    if (authHeader) headers.set("Authorization", authHeader);
    return new Request("https://example.com", { headers });
  }

  test("valid token returns true", () => {
    expect(verifyBearerToken(makeRequest("Bearer my-token"), "my-token")).toBe(
      true,
    );
  });

  test("wrong token returns false", () => {
    expect(
      verifyBearerToken(makeRequest("Bearer wrong-token"), "my-token"),
    ).toBe(false);
  });

  test("missing header returns false", () => {
    expect(verifyBearerToken(makeRequest(), "my-token")).toBe(false);
  });

  test("malformed header returns false", () => {
    expect(verifyBearerToken(makeRequest("Basic my-token"), "my-token")).toBe(
      false,
    );
  });
});

describe("verifyAdminToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("valid token returns true", () => {
    vi.stubEnv("ADMIN_TOKEN", "my-secret");
    expect(verifyAdminToken("my-secret")).toBe(true);
  });

  test("wrong token returns false", () => {
    vi.stubEnv("ADMIN_TOKEN", "my-secret");
    expect(verifyAdminToken("wrong")).toBe(false);
  });

  test("returns false when ADMIN_TOKEN not set", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(verifyAdminToken("my-secret")).toBe(false);
  });
});

describe("verifyAdminBearerToken", () => {
  function makeRequest(authHeader?: string): Request {
    const headers = new Headers();
    if (authHeader) headers.set("Authorization", authHeader);
    return new Request("https://example.com", { headers });
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("valid bearer token returns true", () => {
    vi.stubEnv("ADMIN_TOKEN", "my-secret");
    expect(verifyAdminBearerToken(makeRequest("Bearer my-secret"))).toBe(true);
  });

  test("wrong bearer token returns false", () => {
    vi.stubEnv("ADMIN_TOKEN", "my-secret");
    expect(verifyAdminBearerToken(makeRequest("Bearer wrong"))).toBe(false);
  });

  test("returns false when ADMIN_TOKEN not set", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(verifyAdminBearerToken(makeRequest("Bearer my-secret"))).toBe(false);
  });
});
