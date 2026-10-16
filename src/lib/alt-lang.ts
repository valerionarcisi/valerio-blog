export type Lang = "it" | "en";

export interface Existing {
  blog: (lang: Lang, slug: string) => boolean;
  films: (lang: Lang, slug: string) => boolean;
}

const STATIC_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["/", "/en"],
  ["/codice", "/en/code"],
  ["/blog", "/en/blog"],
  ["/films", "/en/films"],
  ["/visti", "/en/watched"],
  ["/ascolti", "/en/listening"],
  ["/who-i-am", "/en/who-i-am"],
  ["/contatti", "/en/contact"],
  ["/privacy-policy", "/en/privacy-policy"],
  ["/non-fa-ridere", "/en/non-fa-ridere"],
  ["/tag", "/en/tag"],
];

const trimSlash = (p: string): string =>
  p.length > 1 ? p.replace(/\/+$/, "") : p;
const withSlash = (p: string): string => (p === "/" ? p : `${p}/`);

/** The same page in the other language, or that language's closest section when the page has no counterpart. */
export function alternatePath(
  pathname: string,
  from: Lang,
  existing: Existing,
): string {
  const path = trimSlash(pathname);
  const to: Lang = from === "it" ? "en" : "it";
  const index = from === "it" ? 0 : 1;

  const exact = STATIC_PAIRS.find((pair) => pair[index] === path);
  if (exact) return withSlash(exact[1 - index]);

  const prefix = to === "en" ? "/en" : "";
  const fromPrefix = from === "en" ? "/en" : "";
  for (const section of ["blog", "films"] as const) {
    const base = `${fromPrefix}/${section}/`;
    if (!path.startsWith(base)) continue;
    const slug = path.slice(base.length).split("/")[0];
    if (slug && existing[section](to, slug))
      return `${prefix}/${section}/${slug}/`;
    return `${prefix}/${section}/`;
  }
  if (path.startsWith(`${fromPrefix}/tag/`)) return `${prefix}/tag/`;

  return to === "en" ? "/en/" : "/";
}
