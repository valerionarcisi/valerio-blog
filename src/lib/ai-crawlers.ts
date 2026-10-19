// AI crawler counter, kept apart from visitor analytics: these bots fetch HTML without running
// JavaScript, so the tracker never sees them. Imported by the edge function too: no `~/` alias,
// no npm imports here.

export type AiBotKind = "training" | "search" | "user";

export interface AiBot {
  bot: string;
  vendor: string;
  kind: AiBotKind;
}

// Tokens as they appear in the User-Agent. "user" = fetched live because someone asked the
// assistant about the page; "search" = index behind cited answers; "training" = model datasets.
export const AI_BOTS: AiBot[] = [
  { bot: "GPTBot", vendor: "OpenAI", kind: "training" },
  { bot: "OAI-SearchBot", vendor: "OpenAI", kind: "search" },
  { bot: "ChatGPT-User", vendor: "OpenAI", kind: "user" },
  { bot: "ClaudeBot", vendor: "Anthropic", kind: "training" },
  { bot: "Claude-SearchBot", vendor: "Anthropic", kind: "search" },
  { bot: "Claude-User", vendor: "Anthropic", kind: "user" },
  { bot: "PerplexityBot", vendor: "Perplexity", kind: "search" },
  { bot: "Perplexity-User", vendor: "Perplexity", kind: "user" },
  { bot: "meta-externalagent", vendor: "Meta", kind: "training" },
  { bot: "meta-externalfetcher", vendor: "Meta", kind: "user" },
  { bot: "MistralAI-User", vendor: "Mistral", kind: "user" },
  { bot: "DuckAssistBot", vendor: "DuckDuckGo", kind: "search" },
  { bot: "Amazonbot", vendor: "Amazon", kind: "training" },
  { bot: "Bytespider", vendor: "ByteDance", kind: "training" },
  { bot: "CCBot", vendor: "Common Crawl", kind: "training" },
  { bot: "cohere-ai", vendor: "Cohere", kind: "training" },
  { bot: "YouBot", vendor: "You.com", kind: "search" },
];

const LOWER = AI_BOTS.map((b) => [b.bot.toLowerCase(), b] as const);

export function matchAiBot(ua: string | null | undefined): AiBot | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  for (const [token, bot] of LOWER) if (s.includes(token)) return bot;
  return null;
}

// Machine-readable entry points are worth seeing (did the bot read llms.txt?); other files are noise.
const KEEP_FILES = /^\/(robots\.txt|llms(-full)?\.txt|sitemap[\w-]*\.xml|rss\.xml|en\/rss\.xml)$/;
const SKIP_PREFIX = /^\/(api|admin|_astro|_image|img|videos|fonts|\.netlify)(\/|$)/;

export function shouldRecordPath(pathname: string): boolean {
  if (pathname.length > 200 || SKIP_PREFIX.test(pathname)) return false;
  if (KEEP_FILES.test(pathname)) return true;
  return !/\.[a-z0-9]{1,5}$/i.test(pathname);
}

/** Trailing slash dropped so `/visti` and `/visti/` count as one page. */
export const normalizePath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export const AI_CRAWLS_DDL = `CREATE TABLE IF NOT EXISTS ai_crawls (
  day      TEXT NOT NULL,
  bot      TEXT NOT NULL,
  pathname TEXT NOT NULL,
  hits     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, bot, pathname)
)`;

export const AI_CRAWL_UPSERT = `INSERT INTO ai_crawls (day, bot, pathname, hits) VALUES (?, ?, ?, 1)
  ON CONFLICT (day, bot, pathname) DO UPDATE SET hits = hits + 1`;

/** libsql:// URL -> Turso HTTP pipeline endpoint (the edge runtime has no libsql client). */
export function tursoPipelineUrl(dbUrl: string): string {
  return dbUrl.replace(/^libsql:\/\//, "https://").replace(/\/+$/, "") + "/v2/pipeline";
}

export function crawlPipelineBody(day: string, bot: string, pathname: string) {
  const text = (value: string) => ({ type: "text", value });
  return {
    requests: [
      { type: "execute", stmt: { sql: AI_CRAWLS_DDL } },
      { type: "execute", stmt: { sql: AI_CRAWL_UPSERT, args: [text(day), text(bot), text(pathname)] } },
      { type: "close" },
    ],
  };
}

export const AI_KIND_BY_BOT: Record<string, AiBot> = Object.fromEntries(AI_BOTS.map((b) => [b.bot, b]));
