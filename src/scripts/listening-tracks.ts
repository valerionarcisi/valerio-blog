export interface ListeningTrack {
  name: string;
  url: string;
  artist: string;
  album: string;
  image: string;
  date: string | null;
}

export interface ListeningOptions {
  locale: string;
  recentlyLabel: string;
}

type Child = Node | string | null | undefined | false;

function el(tag: string, attrs?: Record<string, string> | null, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export async function fetchListening(): Promise<ListeningTrack[]> {
  const res = await fetch("/api/lastfm");
  if (!res.ok) throw new Error(`Failed to fetch tracks: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as ListeningTrack[]) : [];
}

function formatDate(raw: string | null, opts: ListeningOptions): string {
  if (!raw) return opts.recentlyLabel;
  const d = new Date(`${raw} UTC`);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(opts.locale, { day: "numeric", month: "short", year: "numeric" });
}

function dedupe(tracks: ListeningTrack[]): ListeningTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = `${t.artist}|${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compactItem(t: ListeningTrack, opts: ListeningOptions): HTMLElement {
  const cover = el("div", { class: "fh-lib-cover" });
  if (t.image) cover.style.backgroundImage = `url('${t.image}')`;
  const title = el("div", { class: "fh-lib-title" }, `${t.artist} — `, el("em", null, t.name));
  const detail = el("div", { class: "fh-lib-detail" }, formatDate(t.date, opts));
  return el("li", null, cover, title, detail);
}

export function renderListening(
  block: HTMLElement,
  tracks: ListeningTrack[],
  opts: ListeningOptions,
): void {
  const ul = el("ul", { class: "fh-lib-list fh-lib-list--music" });
  ul.setAttribute("data-listening-list", "");
  for (const t of dedupe(tracks).slice(0, 5)) ul.append(compactItem(t, opts));

  const existing = block.querySelector("ul[data-listening-list], .fh-lib-fallback");
  if (existing) {
    existing.replaceWith(ul);
    return;
  }
  const actions = block.querySelector(".fh-lib-actions");
  if (actions) block.insertBefore(ul, actions);
  else block.append(ul);
}

const REFRESH_MS = 30_000;

export function watchListening(block: HTMLElement, opts: ListeningOptions): void {
  const refresh = () =>
    fetchListening()
      .then((tracks) => {
        if (tracks.length > 0) renderListening(block, tracks, opts);
      })
      .catch(() => {});
  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
}
