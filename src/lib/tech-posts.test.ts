import { describe, it, expect } from "vitest";
import { isTechnicalPost } from "./tech-posts";

describe("isTechnicalPost", () => {
  it("accepts a post with at least one technical tag, case-insensitively", () => {
    expect(isTechnicalPost(["thoughts", "TypeScript"])).toBe(true);
  });

  it("rejects personal and film posts", () => {
    expect(isTechnicalPost(["thoughts"])).toBe(false);
    expect(isTechnicalPost(["MOVIE", "SERIES"])).toBe(false);
  });

  it("rejects a post without tags", () => {
    expect(isTechnicalPost([])).toBe(false);
  });
});
