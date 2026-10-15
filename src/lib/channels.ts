export type Channel =
  "direct" | "search" | "social" | "ai" | "email" | "referral" | "campaign";

// A trailing "." means "any TLD / subdomain start" (e.g. "yahoo." matches yahoo.com, search.yahoo.co.jp).
const AI = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "copilot.",
  "you.com",
  "phind.com",
  "poe.com",
  "deepseek.com",
  "grok.com",
];
const EMAIL = [
  "mail.google.com",
  "gmail.",
  "outlook.",
  "mail.yahoo.com",
  "mail.",
  "webmail.",
  "proton.me",
  "protonmail.com",
];
const SEARCH = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "ecosia.org",
  "yahoo.",
  "brave.com",
  "qwant.com",
  "startpage.com",
  "yandex.",
  "baidu.com",
  "kagi.com",
];
const SOCIAL = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "t.co",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "lnkd.in",
  "threads.net",
  "threads.com",
  "bsky.app",
  "reddit.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "pinterest.",
  "mastodon.",
  "t.me",
  "news.ycombinator.com",
];

function matches(host: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (p.endsWith(".")) {
      return host.startsWith(p) || host.includes(`.${p}`);
    }
    return host === p || host.endsWith(`.${p}`);
  });
}

function fromLabel(label: string): Channel | null {
  if (/^(email|e-mail|newsletter|mail)$/.test(label)) return "email";
  if (
    /^(social|social-media|twitter|x|facebook|instagram|linkedin|bluesky|bsky|threads|reddit|tiktok|youtube)$/.test(
      label,
    )
  ) {
    return "social";
  }
  if (/^(chatgpt|perplexity|claude|gemini|copilot|ai)$/.test(label))
    return "ai";
  if (/^(organic|search)$/.test(label)) return "search";
  return null;
}

export function classifyChannel(input: {
  referrerHost?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
}): Channel {
  const medium = input.utmMedium?.trim().toLowerCase() || null;
  const source = input.utmSource?.trim().toLowerCase() || null;
  const host =
    input.referrerHost
      ?.trim()
      .toLowerCase()
      .replace(/^www\./, "") || null;

  if (medium) {
    if (
      /^(cpc|ppc|paid|paidsearch|banner|display|affiliate|cpm)$/.test(medium)
    ) {
      return "campaign";
    }
    const m = fromLabel(medium);
    if (m) return m;
    return "campaign";
  }
  if (source) return fromLabel(source) ?? "campaign";

  if (!host) return "direct";
  if (matches(host, AI)) return "ai";
  if (matches(host, EMAIL)) return "email";
  if (matches(host, SEARCH)) return "search";
  if (matches(host, SOCIAL)) return "social";
  return "referral";
}
