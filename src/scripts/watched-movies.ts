import { formatMoneyCompact } from "~/lib/format-money";
import { letterboxdDirectorUrl } from "~/lib/letterboxd-slug";

export interface WatchedMovie {
  title: string;
  posterPath: string | null;
  budget: number | null;
  revenue: number | null;
  directors: string[];
  overview: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  runtime: number | null;
  rating: string | null;
  watchedDate: string | null;
  link: string;
}

export interface CompactOptions {
  locale: string;
  byLabel: string;
}

export interface FullOptions {
  locale: string;
  byLabel: string;
  myRatingLabel: (rating: string) => string;
}

type Child = Node | string | null | undefined | false;

function el(
  tag: string,
  attrs?: Record<string, string> | null,
  ...children: Child[]
): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function formatDate(raw: string | null, locale: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export async function fetchWatched(): Promise<WatchedMovie[]> {
  const res = await fetch("/api/letterboxd");
  if (!res.ok) throw new Error(`Failed to fetch watched movies: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as WatchedMovie[]) : [];
}

function compactItem(m: WatchedMovie, opts: CompactOptions): HTMLElement {
  const cover = el("div", { class: "fh-lib-cover" });
  if (m.posterPath) {
    cover.style.backgroundImage = `url('https://image.tmdb.org/t/p/w92/${m.posterPath}')`;
  }

  const title = el("div", { class: "fh-lib-title" }, el("em", null, m.title));

  const b = formatMoneyCompact(m.budget);
  const r = formatMoneyCompact(m.revenue);
  if (b || r) {
    title.append(
      el(
        "span",
        { class: "fh-lib-money", title: "Budget → Box office" },
        `${b ?? "—"} `,
        el("span", { class: "fh-lib-money-arrow" }, "→"),
        ` ${r ?? "—"}`,
      ),
    );
  }

  if (m.directors.length > 0) {
    title.append(
      el("span", { class: "fh-lib-director" }, `${opts.byLabel} ${m.directors.join(", ")}`),
    );
  }

  const detail = el("div", { class: "fh-lib-detail" }, formatDate(m.watchedDate, opts.locale));
  return el("li", null, cover, title, detail);
}

export function renderCompact(
  block: HTMLElement,
  movies: WatchedMovie[],
  opts: CompactOptions,
): void {
  const ul = el("ul", { class: "fh-lib-list fh-lib-list--films" });
  ul.setAttribute("data-watched-list", "");
  for (const m of movies.slice(0, 5)) ul.append(compactItem(m, opts));

  const existing = block.querySelector("ul[data-watched-list], .fh-lib-fallback");
  if (existing) {
    existing.replaceWith(ul);
    return;
  }
  const actions = block.querySelector(".fh-lib-actions");
  if (actions) block.insertBefore(ul, actions);
  else block.append(ul);
}

function fullRow(m: WatchedMovie, opts: FullOptions): HTMLElement {
  const cover = el("div", { class: "vw-cover" });
  if (m.posterPath) {
    cover.style.backgroundImage = `url('https://image.tmdb.org/t/p/w185/${m.posterPath}')`;
  }

  const col = el("div", { class: "vw-main-col" }, el("h3", { class: "vw-title" }, m.title));

  if (m.directors.length > 0) {
    const span = el("span");
    m.directors.forEach((d, i) => {
      if (i > 0) span.append(", ");
      span.append(
        el(
          "a",
          {
            class: "vw-director-link",
            href: letterboxdDirectorUrl(d),
            target: "_blank",
            rel: "noopener noreferrer",
          },
          d,
        ),
      );
    });
    col.append(el("p", { class: "vw-director" }, `${opts.byLabel} `, span));
  }

  if (m.overview) col.append(el("p", { class: "vw-overview" }, m.overview));

  const meta = el("div", { class: "vw-meta" });
  if (m.releaseDate) meta.append(el("span", null, m.releaseDate.slice(0, 4)));
  if (typeof m.runtime === "number" && m.runtime > 0) {
    meta.append(el("span", null, `${m.runtime}′`));
  }
  if (typeof m.voteAverage === "number" && m.voteAverage > 0) {
    meta.append(el("span", null, `★ ${m.voteAverage.toFixed(1)}`));
  }
  if (m.rating) {
    meta.append(el("span", { class: "vw-my-rating" }, opts.myRatingLabel(m.rating)));
  }
  col.append(meta);

  const side = el("div", { class: "vw-side" });
  const b = formatMoneyCompact(m.budget);
  const r = formatMoneyCompact(m.revenue);
  if (b || r) {
    side.append(
      el(
        "div",
        { class: "vw-money" },
        el("span", { class: "vw-money-budget" }, b ?? "—"),
        el("span", { class: "vw-money-arrow" }, "→"),
        el("span", { class: "vw-money-revenue" }, r ?? "—"),
      ),
    );
  }
  side.append(el("time", { class: "vw-date" }, formatDate(m.watchedDate, opts.locale)));

  return el("li", { class: "vw-row" }, cover, col, side);
}

function setStat(key: string, value: string): void {
  const node = document.querySelector(`[data-stat="${key}"]`);
  if (node) node.textContent = value;
}

function updateStats(movies: WatchedMovie[]): void {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = movies.filter((m) => {
    const t = m.watchedDate ? new Date(m.watchedDate).getTime() : NaN;
    return Number.isFinite(t) && t >= weekAgo;
  }).length;

  const minutes = movies.reduce(
    (s, m) => s + (typeof m.runtime === "number" && m.runtime > 0 ? m.runtime : 0),
    0,
  );

  const myRatings = movies
    .map((m) => (m.rating ? Number(m.rating) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  const tmdbRatings = movies
    .map((m) => (typeof m.voteAverage === "number" ? m.voteAverage : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);

  let avg = "—";
  if (myRatings.length > 0) {
    avg = `★ ${(myRatings.reduce((s, n) => s + n, 0) / myRatings.length).toFixed(1)}/5`;
  } else if (tmdbRatings.length > 0) {
    avg = `★ ${(tmdbRatings.reduce((s, n) => s + n, 0) / tmdbRatings.length).toFixed(1)}/10`;
  }

  setStat("total", String(movies.length));
  setStat("week", String(week));
  setStat("hours", `${Math.round(minutes / 60)} h`);
  setStat("rating", avg);
}

export function renderFull(
  main: HTMLElement,
  movies: WatchedMovie[],
  opts: FullOptions,
): void {
  const groups = new Map<string, WatchedMovie[]>();
  for (const m of movies) {
    const year = m.watchedDate ? String(new Date(m.watchedDate).getFullYear()) : "—";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(m);
  }

  const years = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  const sections = years.map((year) => {
    const list = el("ul", { class: "vw-list" });
    for (const m of groups.get(year)!) list.append(fullRow(m, opts));
    return el(
      "section",
      { class: "vw-year" },
      el("h2", { class: "vw-year-label" }, year),
      list,
    );
  });

  main.replaceChildren(...sections);
  updateStats(movies);
}
