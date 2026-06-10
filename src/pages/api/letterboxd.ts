import type { APIRoute } from "astro";
import {
  getLetterboxdRss,
  parseXmlContent,
  letterboxdFilmSlug,
  extractReviewHtml,
} from "~/services/letterboxd";
import { getMovieById, extractDirectors } from "~/services/tmdb";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const rss = await getLetterboxdRss();
    const parsed = (await parseXmlContent(await rss.text())) as any;
    const items = (parsed?.rss?.channel?.[0]?.item ?? []).filter(
      (it: any) => it?.["tmdb:movieId"]?.[0],
    );

    const movies = await Promise.all(
      items.map(async (it: any) => {
        try {
          const movie: any = await getMovieById(it["tmdb:movieId"][0]);
          const link = it.link?.[0] ?? "";
          return {
            title: it["letterboxd:filmTitle"]?.[0] ?? movie.title ?? "",
            slug: letterboxdFilmSlug(link),
            posterPath: movie.poster_path ?? null,
            budget: typeof movie.budget === "number" ? movie.budget : null,
            revenue: typeof movie.revenue === "number" ? movie.revenue : null,
            directors: extractDirectors(movie),
            overview: movie.overview ?? null,
            releaseDate: movie.release_date ?? null,
            voteAverage: typeof movie.vote_average === "number" ? movie.vote_average : null,
            runtime: typeof movie.runtime === "number" ? movie.runtime : null,
            rating: it["letterboxd:memberRating"]?.[0] ?? null,
            liked: it["letterboxd:memberLike"]?.[0] === "Yes",
            watchedDate: it["letterboxd:watchedDate"]?.[0] ?? null,
            review: extractReviewHtml(it.description?.[0]),
            link,
          };
        } catch {
          return null;
        }
      }),
    );

    return new Response(JSON.stringify(movies.filter(Boolean)), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
