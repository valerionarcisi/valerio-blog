import { describe, test, expect } from "vitest";
import { toFiniteNumber } from "~/pages/api/e";

describe("toFiniteNumber", () => {
  test("null returns null", () => {
    expect(toFiniteNumber(null)).toBeNull();
  });

  test("undefined returns null", () => {
    expect(toFiniteNumber(undefined)).toBeNull();
  });

  test("42 returns 42", () => {
    expect(toFiniteNumber(42)).toBe(42);
  });

  test("'abc' returns null", () => {
    expect(toFiniteNumber("abc")).toBeNull();
  });

  test("Infinity returns null", () => {
    expect(toFiniteNumber(Infinity)).toBeNull();
  });

  test("NaN returns null", () => {
    expect(toFiniteNumber(NaN)).toBeNull();
  });

  test("0 returns 0", () => {
    expect(toFiniteNumber(0)).toBe(0);
  });

  test("string '3.14' returns 3.14", () => {
    expect(toFiniteNumber("3.14")).toBe(3.14);
  });
});
