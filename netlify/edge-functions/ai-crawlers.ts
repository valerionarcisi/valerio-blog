// Counts AI crawler page fetches (bot, page, day; nothing else). Edge, not a Function: static pages
// are served by the CDN and never reach a serverless function. Humans pass through untouched.
import { crawlPipelineBody, matchAiBot, normalizePath, shouldRecordPath, tursoPipelineUrl } from "../../src/lib/ai-crawlers.ts";

declare const Netlify: { env: { get(key: string): string | undefined } };
// Minimal shapes of @netlify/edge-functions (not installed: the bundler provides the runtime).
interface Context {
  next(): Promise<Response>;
  waitUntil(p: Promise<unknown>): void;
}

export default async (request: Request, context: Context) => {
  const bot = matchAiBot(request.headers.get("user-agent"));
  if (!bot) return;
  const { pathname } = new URL(request.url);
  if (!shouldRecordPath(pathname)) return;

  const res = await context.next();
  // Only real pages: a spoofed UA probing random URLs gets 404s and leaves no rows.
  if (res.status >= 400) return res;

  const dbUrl = Netlify.env.get("TURSO_DATABASE_URL");
  if (dbUrl) {
    const day = new Date().toISOString().slice(0, 10);
    context.waitUntil(
      fetch(tursoPipelineUrl(dbUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Netlify.env.get("TURSO_AUTH_TOKEN") ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(crawlPipelineBody(day, bot.bot, normalizePath(pathname))),
      })
        .then((r) => {
          if (!r.ok) console.error("[ai-crawlers] turso", r.status);
        })
        .catch((e) => console.error("[ai-crawlers]", e)),
    );
  }
  return res;
};

export const config = {
  path: "/*",
  excludedPath: ["/api/*", "/admin/*", "/_astro/*", "/_image", "/img/*", "/videos/*", "/fonts/*"],
};
