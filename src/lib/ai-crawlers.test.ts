import { describe, test, expect } from "vitest";
import { createClient } from "@libsql/client";
import {
  AI_CRAWL_UPSERT,
  AI_CRAWLS_DDL,
  crawlPipelineBody,
  matchAiBot,
  normalizePath,
  shouldRecordPath,
  tursoPipelineUrl,
} from "./ai-crawlers";
import { aiCrawlStats } from "./ai-crawlers-stats";
import { SESSIONS_DDL } from "./analytics-sessions";

describe("matchAiBot", () => {
  test.each([
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", "GPTBot", "training"],
    ["Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "OAI-SearchBot", "search"],
    ["Mozilla/5.0 AppleWebKit/537.36; compatible; ChatGPT-User/1.0", "ChatGPT-User", "user"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "training"],
    ["Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)", "Claude-User", "user"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot", "search"],
    ["meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", "meta-externalagent", "training"],
  ])("%s", (ua, bot, kind) => {
    expect(matchAiBot(ua)).toMatchObject({ bot, kind });
  });

  test("browsers and search engines are not AI bots", () => {
    expect(matchAiBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15")).toBeNull();
    expect(matchAiBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBeNull();
    expect(matchAiBot(null)).toBeNull();
  });
});

describe("shouldRecordPath", () => {
  test.each([
    ["/", true],
    ["/blog/21-giorni-senza-alcol", true],
    ["/en/films/caramella/", true],
    ["/llms.txt", true],
    ["/robots.txt", true],
    ["/sitemap-0.xml", true],
    ["/rss.xml", true],
    ["/api/stats", false],
    ["/admin", false],
    ["/_astro/index.abc123.css", false],
    ["/img/caramella/cover.jpg", false],
    ["/favicon.ico", false],
    ["/wp-login.php", false],
    ["/" + "a".repeat(250), false],
  ])("%s -> %s", (p, expected) => {
    expect(shouldRecordPath(p)).toBe(expected);
  });

  test("normalizePath drops the trailing slash except on the root", () => {
    expect(normalizePath("/visti/")).toBe("/visti");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("Turso HTTP pipeline", () => {
  test("libsql URL becomes the pipeline endpoint", () => {
    expect(tursoPipelineUrl("libsql://blog-valerio.turso.io")).toBe("https://blog-valerio.turso.io/v2/pipeline");
  });

  test("body creates the table, upserts the row, closes the stream", () => {
    const body = crawlPipelineBody("2026-10-19", "GPTBot", "/");
    expect(body.requests.map((r) => r.type)).toEqual(["execute", "execute", "close"]);
    expect(body.requests[1]).toMatchObject({ stmt: { args: [{ value: "2026-10-19" }, { value: "GPTBot" }, { value: "/" }] } });
  });
});

describe("aiCrawlStats", () => {
  test("aggregates bots, pages and days; human visits come from the ai channel only", async () => {
    const db = createClient({ url: ":memory:" });
    await db.execute(AI_CRAWLS_DDL);
    for (const [day, bot, p] of [
      ["2026-10-18", "GPTBot", "/"],
      ["2026-10-18", "GPTBot", "/"],
      ["2026-10-18", "ClaudeBot", "/"],
      ["2026-10-19", "PerplexityBot", "/llms.txt"],
      ["2026-09-01", "GPTBot", "/old"],
    ])
      await db.execute({ sql: AI_CRAWL_UPSERT, args: [day, bot, p] });
    await db.executeMultiple(SESSIONS_DDL + "; CREATE TABLE bot_hashes (hash TEXT PRIMARY KEY);");
    const s = (channel: string, referrer: string | null, human: number) =>
      db.execute({
        sql: `INSERT INTO sessions (day, visitor_hash, started_at, last_seen_at, entry_path, channel, referrer, human)
              VALUES ('2026-10-18', ?, '2026-10-18 10:00:00', '2026-10-18 10:00:00', '/blog/a', ?, ?, ?)`,
        args: [Math.random().toString(36), channel, referrer, human],
      });
    await s("ai", "chatgpt.com", 1);
    await s("ai", "chatgpt.com", 0);
    await s("search", "www.google.com", 1);

    const r = await aiCrawlStats(db, "2026-10-12", "2026-10-19");
    expect(r.total).toBe(4);
    expect(r.by_bot[0]).toEqual({ bot: "GPTBot", vendor: "OpenAI", kind: "training", hits: 2 });
    expect(r.by_page[0]).toEqual({ pathname: "/", hits: 3, bots: ["ClaudeBot", "GPTBot"] });
    expect(r.daily).toEqual([
      { day: "2026-10-18", hits: 3 },
      { day: "2026-10-19", hits: 1 },
    ]);
    expect(r.human).toEqual({
      available: true,
      sessions: 1,
      by_source: [{ source: "chatgpt.com", sessions: 1 }],
      by_page: [{ pathname: "/blog/a", sessions: 1 }],
    });
  });

  test("before the first AI fetch the table does not exist: available false, no error", async () => {
    const r = await aiCrawlStats(createClient({ url: ":memory:" }), "2026-10-12", "2026-10-19");
    expect(r.available).toBe(false);
    expect(r.human.available).toBe(false);
  });
});
