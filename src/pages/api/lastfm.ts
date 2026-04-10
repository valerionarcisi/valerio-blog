import type { APIRoute } from "astro";
import { env } from "~/lib/env";

export const prerender = false;

const LASTFM_API_KEY = env("LASTFM_API_KEY");
const LASTFM_USER = "valerionar";
const PLACEHOLDER_IMAGE =
  "https://lastfm.freetls.fastly.net/i/u/34s/2a96cbd8b46e442fc41c2b86b821562f.png";

export const GET: APIRoute = async () => {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: LASTFM_USER,
    api_key: LASTFM_API_KEY,
    format: "json",
    limit: "20",
  });

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch tracks" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const tracks = data.recenttracks.track
      .filter(
        (track: any) =>
          track.album?.["#text"] !== "" &&
          track.image?.[0]?.["#text"] !== PLACEHOLDER_IMAGE,
      )
      .map((track: any) => ({
        name: track.name,
        url: track.url,
        artist: track.artist["#text"],
        album: track.album["#text"],
        image: track.image?.[3]?.["#text"] ?? "",
        date: track.date?.["#text"] ?? null,
      }));

    return new Response(JSON.stringify(tracks), {
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
