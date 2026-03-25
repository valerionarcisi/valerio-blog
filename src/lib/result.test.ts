import { describe, test, expect } from "vitest";
import {
  ok,
  err,
  andThen,
  pipe,
  isValidDate,
  isNonEmptyString,
  isValidEmail,
  clampInt,
} from "./result";

describe("ok / err", () => {
  test("ok wraps value with ok:true", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  test("err wraps error with ok:false", () => {
    const r = err("boom");
    expect(r).toEqual({ ok: false, error: "boom" });
  });
});

describe("andThen", () => {
  test("chains on ok", () => {
    const r = andThen(ok(2), (n) => ok(n * 3));
    expect(r).toEqual({ ok: true, value: 6 });
  });

  test("short-circuits on err", () => {
    const r = andThen(err("nope"), () => ok(42));
    expect(r).toEqual({ ok: false, error: "nope" });
  });

  test("transforms ok to err", () => {
    const r = andThen(ok(-1), (n) => (n < 0 ? err("negative") : ok(n)));
    expect(r).toEqual({ ok: false, error: "negative" });
  });
});

describe("pipe", () => {
  test("pipes single function", () => {
    expect(pipe(2, (n: number) => n * 3)).toBe(6);
  });

  test("pipes two functions", () => {
    expect(
      pipe(
        "hello",
        (s: string) => s.toUpperCase(),
        (s: string) => s.length,
      ),
    ).toBe(5);
  });

  test("pipes three functions", () => {
    expect(
      pipe(
        [1, 2, 3],
        (a: number[]) => a.filter((n) => n > 1),
        (a: number[]) => a.map((n) => n * 10),
        (a: number[]) => a.reduce((s, n) => s + n, 0),
      ),
    ).toBe(50);
  });

  test("pipes with Result pattern", () => {
    const result = pipe(
      ok(10),
      (r) => andThen(r, (n) => (n > 0 ? ok(n * 2) : err("must be positive"))),
      (r) => andThen(r, (n) => ok(`result: ${n}`)),
    );
    expect(result).toEqual({ ok: true, value: "result: 20" });
  });

  test("pipe + andThen short-circuits on error", () => {
    const result = pipe(
      ok(-5),
      (r) => andThen(r, (n) => (n > 0 ? ok(n) : err("negative"))),
      (r) => andThen(r, (n) => ok(n * 100)),
    );
    expect(result).toEqual({ ok: false, error: "negative" });
  });
});

describe("isNonEmptyString", () => {
  test("accepts non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("a")).toBe(true);
  });

  test("rejects empty/whitespace strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
  });

  test("rejects non-strings", () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
  });
});

describe("isValidEmail", () => {
  test("accepts valid emails", () => {
    expect(isValidEmail("a@b.c")).toBe(true);
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  test("rejects invalid emails", () => {
    expect(isValidEmail("not-email")).toBe(false);
    expect(isValidEmail("@missing.com")).toBe(false);
    expect(isValidEmail("a@.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  test("rejects overly long emails", () => {
    expect(isValidEmail("a".repeat(252) + "@b.c")).toBe(false);
  });

  test("rejects non-strings", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });
});

describe("isValidDate", () => {
  test("accepts YYYY-MM-DD", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
  });

  test("rejects invalid formats", () => {
    expect(isValidDate("15-01-2024")).toBe(false);
    expect(isValidDate("2024/01/15")).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

describe("clampInt", () => {
  test("clamps and rounds", () => {
    expect(clampInt(5, 0, 10, 0)).toBe(5);
    expect(clampInt(15, 0, 10, 0)).toBe(10);
    expect(clampInt(5.7, 0, 10, 0)).toBe(6);
  });

  test("fallback for invalid input", () => {
    expect(clampInt(null, 0, 10, 7)).toBe(7);
    expect(clampInt(undefined, 0, 10, 7)).toBe(7);
    expect(clampInt(NaN, 0, 10, 7)).toBe(7);
  });
});
