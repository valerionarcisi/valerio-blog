import type { APIRoute } from "astro";
import { parseString } from "xml2js";
import { env } from "~/lib/env";

export const prerender = false;

const TMDB_API_KEY = env("TMDB_API_KEY");

const parseXml = (xml: string): Promise<any> =>
  new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

export const GET: APIRoute = async () => {
  try {
    const rssResponse = await fetch("https://letterboxd.com/valenar/rss/");
    if (!rssResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch RSS" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const xml = await rssResponse.text();
    const parsed = await parseXml(xml);
    const items = parsed.rss.channel[0].item.filter(
      (item: any) => item?.["tmdb:movieId"]?.[0],
    );

    const movies = await Promise.all(
      items.map(async (item: any) => {
        try {
          const tmdbResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${item["tmdb:movieId"][0]}?api_key=${TMDB_API_KEY}`,
          );
          if (!tmdbResponse.ok) return null;
          const movie = await tmdbResponse.json();
          return {
            title: item["letterboxd:filmTitle"]?.[0] ?? movie.title,
            posterPath: movie.poster_path,
            voteAverage: movie.vote_average,
            voteCount: movie.vote_count,
            link: item.link?.[0] ?? "",
            watchedDate: item["letterboxd:watchedDate"]?.[0] ?? "",
          };
        } catch {
          return null;
        }
      }),
    );

    return new Response(JSON.stringify(movies.filter(Boolean)), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
