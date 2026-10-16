const TECH_TAGS = new Set([
  "ai",
  "astro",
  "css",
  "effect-ts",
  "frontend",
  "git",
  "how-to",
  "javascript",
  "playwright",
  "programmazione-funzionale",
  "result-pattern",
  "testing",
  "typescript",
  "vanilla-extract",
  "@vanilla-extract",
]);

export const isTechnicalPost = (tags: readonly string[]): boolean =>
  tags.some((tag) => TECH_TAGS.has(tag.toLowerCase().trim()));
