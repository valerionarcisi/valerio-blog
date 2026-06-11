import { formatMoneyCompact } from "~/lib/format-money";
import { letterboxdDirectorUrl, letterboxdFilmUrl } from "~/lib/letterboxd-slug";

export interface WatchedMovie {
  title: string;
  slug: string | null;
  posterPath: string | null;
  budget: number | null;
  revenue: number | null;
  directors: string[];
  overview: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  runtime: number | null;
  rating: string | null;
  liked: boolean;
  watchedDate: string | null;
  review: string | null;
  link: string;
}

export interface CompactOptions {
  locale: string;
  byLabel: string;
  likedLabel?: string;
  notLikedLabel?: string;
}

export interface ReviewLabels {
  toggle: string;
  clapCta: string;
  clapYoursOne: string;
  clapYours: string;
  clapCapped: string;
}

export interface FullOptions {
  locale: string;
  byLabel: string;
  myRatingLabel: (rating: string) => string;
  likedLabel: string;
  notLikedLabel: string;
  review: ReviewLabels;
}

// Filled heart when liked on Letterboxd, hollow heart otherwise.
function likeHeart(liked: boolean, likedLabel: string, notLikedLabel: string): HTMLElement {
  return el(
    "span",
    {
      class: `vw-like${liked ? " is-liked" : ""}`,
      title: liked ? likedLabel : notLikedLabel,
      "aria-label": liked ? likedLabel : notLikedLabel,
    },
    liked ? "♥" : "♡",
  );
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

function lbxdLink(m: WatchedMovie): string | null {
  return letterboxdFilmUrl(m.slug);
}

function compactItem(m: WatchedMovie, opts: CompactOptions): HTMLElement {
  const href = lbxdLink(m);
  const cover = href
    ? el("a", {
        class: "fh-lib-cover fh-lib-cover-link",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `${m.title} su Letterboxd`,
      })
    : el("div", { class: "fh-lib-cover" });
  if (m.posterPath) {
    (cover as HTMLElement).style.backgroundImage = `url('https://image.tmdb.org/t/p/w92/${m.posterPath}')`;
  }

  const titleNode = href
    ? el("a", { class: "fh-lib-title-link", href, target: "_blank", rel: "noopener noreferrer" }, el("em", null, m.title))
    : el("em", null, m.title);
  const title = el("div", { class: "fh-lib-title" }, titleNode);
  if (m.liked) {
    title.append(
      el("span", { class: "fh-lib-like", title: opts.likedLabel ?? "Mi è piaciuto" }, "♥"),
    );
  }
  if (m.review && m.slug) {
    title.append(el("span", { class: "fh-lib-review-dot", title: "Ha una recensione" }));
  }

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

const CLAP_MAX = 50;

function cloneClapIcons(): DocumentFragment {
  const tpl = document.getElementById("vw-clap-icons") as HTMLTemplateElement | null;
  return tpl ? (tpl.content.cloneNode(true) as DocumentFragment) : document.createDocumentFragment();
}

// Lazy claps: the count is only fetched the first time the review is opened,
// so a /visti page with many reviewed films makes zero clap requests on load.
function buildReviewClaps(slug: string, labels: ReviewLabels): HTMLElement {
  const total = el("span", { class: "PostClaps-total" }, "0");
  const button = el(
    "button",
    { type: "button", class: "PostClaps-button", "aria-label": labels.clapCta },
    cloneClapIcons(),
    total,
  );
  const yours = el("p", { class: "PostClaps-yours", hidden: "" });
  const section = el("div", { class: "PostClaps PostClaps--inline" }, button, yours);

  const postId = `review:${slug}`;
  let mine = 0;
  let count = 0;
  let max = CLAP_MAX;
  let loaded = false;
  let inflight = 0;

  function render(): void {
    total.textContent = String(count);
    button.classList.toggle("is-capped", mine >= max);
    button.classList.toggle("is-active", mine > 0);
    button.setAttribute("aria-pressed", mine > 0 ? "true" : "false");
    if (mine === 0) {
      yours.hidden = true;
      yours.textContent = "";
    } else if (mine >= max) {
      yours.hidden = false;
      yours.textContent = labels.clapCapped;
    } else if (mine === 1) {
      yours.hidden = false;
      yours.textContent = labels.clapYoursOne;
    } else {
      yours.hidden = false;
      yours.textContent = labels.clapYours.replace("{n}", String(mine));
    }
  }

  function pulse(): void {
    section.querySelectorAll(".PostClaps-icon").forEach((icon) => {
      icon.classList.remove("is-pulsing");
      void (icon as HTMLElement).offsetWidth;
      icon.classList.add("is-pulsing");
    });
  }

  function load(): void {
    if (loaded) return;
    loaded = true;
    fetch(`/api/posts/claps?postId=${encodeURIComponent(postId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.max === "number") max = data.max;
        mine = Number(data.mine) || 0;
        count = Number(data.total) || 0;
        render();
      })
      .catch(() => {});
  }

  button.addEventListener("click", () => {
    if (mine >= max) return;
    mine = Math.min(mine + 1, max);
    count += 1;
    render();
    pulse();
    inflight += 1;
    fetch("/api/posts/claps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => r.json())
      .then((data) => {
        inflight -= 1;
        if (inflight === 0) {
          mine = Number(data.mine) || mine;
          count = Number(data.total) || count;
          if (typeof data.max === "number") max = data.max;
          render();
        }
      })
      .catch(() => {
        inflight -= 1;
      });
  });

  (section as HTMLElement & { loadCounts: () => void }).loadCounts = load;
  return section;
}

function buildReviewBlock(m: WatchedMovie, opts: FullOptions): HTMLElement | null {
  if (!m.review || !m.slug) return null;

  const text = el("div", { class: "vw-review-text" });
  text.innerHTML = m.review;

  const claps = buildReviewClaps(m.slug, opts.review);
  const actions = el("div", { class: "vw-review-actions" }, claps);
  const body = el("div", { class: "vw-review-body", hidden: "" }, text, actions);

  const chevron = el("span", { class: "vw-review-chevron", "aria-hidden": "true" }, "▸");
  const toggle = el(
    "button",
    { type: "button", class: "vw-review-toggle", "aria-expanded": "false" },
    chevron,
    opts.review.toggle,
  );

  let clapsLoaded = false;
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.classList.toggle("is-open", open);
    if (open && !clapsLoaded) {
      clapsLoaded = true;
      (claps as HTMLElement & { loadCounts?: () => void }).loadCounts?.();
    }
  });

  return el("div", { class: "vw-review", id: `review-${m.slug}` }, toggle, body);
}

// When arriving via /visti#review-<slug> (e.g. from the home widget), open
// that review and bring it into view once the list has been re-rendered.
function openReviewFromHash(): void {
  const hash = window.location.hash;
  if (!hash.startsWith("#review-")) return;
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  const toggle = target.querySelector<HTMLButtonElement>(".vw-review-toggle");
  const body = target.querySelector<HTMLElement>(".vw-review-body");
  if (toggle && body && body.hidden) toggle.click();
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fullRow(m: WatchedMovie, opts: FullOptions): HTMLElement {
  const href = lbxdLink(m);
  const cover = href
    ? el("a", {
        class: "vw-cover vw-cover-link",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `${m.title} su Letterboxd`,
      })
    : el("div", { class: "vw-cover" });
  if (m.posterPath) {
    (cover as HTMLElement).style.backgroundImage = `url('https://image.tmdb.org/t/p/w185/${m.posterPath}')`;
  }

  const titleNode = href
    ? el("h3", { class: "vw-title" }, el("a", { class: "vw-title-link", href, target: "_blank", rel: "noopener noreferrer" }, m.title))
    : el("h3", { class: "vw-title" }, m.title);
  const col = el("div", { class: "vw-main-col" }, titleNode);

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

  const reviewBlock = buildReviewBlock(m, opts);
  if (reviewBlock) col.append(reviewBlock);
  else if (m.overview) col.append(el("p", { class: "vw-overview" }, m.overview));

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
  meta.append(likeHeart(m.liked, opts.likedLabel, opts.notLikedLabel));
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
  openReviewFromHash();
}
