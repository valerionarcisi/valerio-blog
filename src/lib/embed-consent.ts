// Third-party embeds (YouTube, Relive...) must NOT be pasted into posts as a raw <iframe>: it would load,
// and the provider would receive the visitor's IP and may set cookies, as soon as the page opens.
// Posts use the click-to-load block built here; src/scripts/embed-consent.ts creates the real iframe only
// after a click. Without JS the block still has a plain "open on <provider>" link.
// Print a ready-to-paste block with:  npx -y tsx scripts/embed-consent-html.ts <embed-url> [it|en] [height]

export type EmbedLang = "it" | "en";

const SITE_HOSTS = new Set(["valerionarcisi.me", "www.valerionarcisi.me", "localhost"]);

const COPY = {
  it: {
    text: (p: string) =>
      `Questo contenuto è ospitato da ${p}. Se lo carichi, ${p} riceve il tuo indirizzo IP e può usare cookie.`,
    load: "Carica il contenuto",
    open: (p: string) => `Apri su ${p}`,
    privacy: "Informativa privacy",
    privacyHref: "/privacy-policy",
  },
  en: {
    text: (p: string) =>
      `This content is hosted by ${p}. If you load it, ${p} receives your IP address and may set cookies.`,
    load: "Load the content",
    open: (p: string) => `Open on ${p}`,
    privacy: "Privacy policy",
    privacyHref: "/en/privacy-policy",
  },
} as const;

export interface EmbedInfo {
  provider: string;
  /** The page to open in a new tab without loading the embed. */
  open: string;
}

/** Provider name and the plain link for a third-party embed URL; null for our own site or an invalid URL. */
export function describeEmbed(src: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(src, "https://valerionarcisi.me");
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (SITE_HOSTS.has(url.hostname) || SITE_HOSTS.has(host)) return null;

  const last = url.pathname.split("/").filter(Boolean).pop();
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    return { provider: "YouTube", open: last ? `https://www.youtube.com/watch?v=${last}` : url.href };
  }
  if (host === "player.vimeo.com") {
    return { provider: "Vimeo", open: last ? `https://vimeo.com/${last}` : url.href };
  }
  if (host === "cdn.embedly.com") {
    // Embedly wraps another provider: the real target is in its `src` query parameter.
    try {
      const target = new URL(url.searchParams.get("src") ?? "");
      const name = target.hostname.replace(/^www\./, "").split(".")[0];
      return {
        provider: name ? name.charAt(0).toUpperCase() + name.slice(1) : "Embedly",
        open: `${target.origin}${target.pathname}`,
      };
    } catch {
      return { provider: "Embedly", open: url.href };
    }
  }
  return { provider: host, open: url.href };
}

const attr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface EmbedBlockOptions {
  src: string;
  lang?: EmbedLang;
  /** Accessible title of the iframe once loaded. */
  title?: string;
  /** Placeholder height in px (the embed's own height). */
  height?: number;
  /** Extra attributes copied onto the iframe when it is created (allow, class, style...). */
  attrs?: Record<string, string>;
}

/** The HTML block to paste in a markdown post. Single-line elements only: markdown keeps it as raw HTML. */
export function embedConsentBlock(o: EmbedBlockOptions): string {
  const info = describeEmbed(o.src);
  if (!info) throw new Error(`Not a third-party embed URL: ${o.src}`);
  const c = COPY[o.lang ?? "it"];
  const attrs = { ...(o.attrs ?? {}) };
  if (o.title) attrs.title = o.title;
  const height = o.height ?? 315;
  // The iframe is created on click with the size the embed was authored with.
  attrs.width ??= "100%";
  attrs.height ??= String(height);
  const style = attrs.style ?? `min-height:${height}px`;
  const cls = ["embed-consent", ...(attrs.class ? attrs.class.split(/\s+/) : [])].join(" ");
  const json = JSON.stringify(attrs);

  return [
    `<div class="${attr(cls)}" style="${attr(style)}" data-embed-src="${attr(o.src)}" data-embed-provider="${attr(info.provider)}" data-embed-attrs="${attr(json)}">`,
    `<div class="embed-consent__box">`,
    `<p class="embed-consent__text">${c.text(info.provider)}</p>`,
    `<p class="embed-consent__actions"><button type="button" class="embed-consent__btn">${c.load}</button> <a class="embed-consent__open" href="${attr(info.open)}" target="_blank" rel="noopener noreferrer">${c.open(info.provider)}</a> <a class="embed-consent__privacy" href="${c.privacyHref}">${c.privacy}</a></p>`,
    `</div>`,
    `</div>`,
  ].join("");
}

/** YouTube's privacy-enhanced domain: no cookies until the visitor plays the video. */
export function privacyFriendlySrc(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname.replace(/^www\./, "") === "youtube.com") {
      url.hostname = "www.youtube-nocookie.com";
      return url.href;
    }
  } catch {
    /* keep the original */
  }
  return src;
}

