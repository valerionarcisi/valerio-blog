import { describe, test, expect } from "vitest";
import { timeSafeEqual, verifyBearerToken } from "./auth";

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

  test("non-ASCII equal strings return true", () => {
    expect(timeSafeEqual("pässwörd-日本", "pässwörd-日本")).toBe(true);
  });

  test("non-ASCII differing strings of same char length return false", () => {
    expect(timeSafeEqual("aé", "ab")).toBe(false);
    expect(timeSafeEqual("é", "e")).toBe(false);
  });

  test("prefix of the token returns false", () => {
    expect(timeSafeEqual("secret", "secret123")).toBe(false);
    expect(timeSafeEqual("secret123", "secret")).toBe(false);
  });

  test("one empty side returns false", () => {
    expect(timeSafeEqual("", "token")).toBe(false);
    expect(timeSafeEqual("token", "")).toBe(false);
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
