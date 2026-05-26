import { z as zod } from "astro:content";
import { env } from "~/lib/env";

export const AUDIO_SCROBBLER_API_KEY = env("LASTFM_API_KEY");
export const AUDIO_SCROBBLER_USER = "valerionar";
export const AUDIO_SCROBBLER_VERSION = "2.0";

const Track = zod.object({
  name: zod.string(),
  url: zod.string(),
  date: zod
    .object({
      "#text": zod.string(),
    })
    .optional(),
  album: zod.object({
    "#text": zod.string(),
  }),
  artist: zod.object({
    "#text": zod.string(),
  }),
  image: zod.array(
    zod.object({
      "#text": zod.string(),
      size: zod.string(),
    }),
  ),
});

const AudioScubblerSchema = zod.object({
  recenttracks: zod.object({
    track: zod.array(Track),
  }),
});

export type AudioScubblerResponse = zod.infer<typeof AudioScubblerSchema>;
export type AudioScubblerTrack = zod.infer<typeof Track>;

export const fetchRecentTracks = async (
  method = "user.getrecenttracks",
  format = "json",
  limit = "20",
): Promise<AudioScubblerTrack[]> => {
  const params = new URLSearchParams({
    method,
    user: AUDIO_SCROBBLER_USER,
    api_key: AUDIO_SCROBBLER_API_KEY,
    format,
    limit,
  });

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
    );

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Failed to fetch tracks. Status: ${response.status}`);
    }

    const jsonData = await response.json();

    // Validate the JSON response with Zod schema
    const parsedData = AudioScubblerSchema.parse(
      jsonData,
    ).recenttracks.track.filter(
      (track) =>
        track.album["#text"] !== "" &&
        track.image[0]["#text"] !==
          "https://lastfm.freetls.fastly.net/i/u/34s/2a96cbd8b46e442fc41c2b86b821562f.png",
    );

    return parsedData;
  } catch (error) {
    if (error instanceof zod.ZodError) {
      console.error("Validation error:", error.errors);
      throw new Error("Invalid data format received from API");
    } else {
      console.error("Error fetching recent tracks:", error);
      throw error;
    }
  }
};

/* ============================================
   Aggregate methods for "Ascolti" / listening page
   ============================================ */

export type Period = "7day" | "1month" | "3month" | "6month" | "12month" | "overall";

export interface TopAlbum {
  name: string;
  artist: string;
  playcount: number;
  url: string;
  imageUrl: string | null;
}

export interface TopArtist {
  name: string;
  playcount: number;
  url: string;
  imageUrl: string | null;
}

export interface UserInfo {
  playcount: number;
  registered: string;
  artistCount: number;
  albumCount: number;
  trackCount: number;
}

const LASTFM_BLANK_IMAGE_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

function isBlankImage(url: string | undefined): boolean {
  if (!url) return true;
  return url.includes(LASTFM_BLANK_IMAGE_HASH);
}

function bestImage(images: { "#text": string; size: string }[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const prefer = ["extralarge", "large", "medium", "small"];
  for (const size of prefer) {
    const found = images.find((i) => i.size === size && i["#text"] && !isBlankImage(i["#text"]));
    if (found) return found["#text"];
  }
  return null;
}

export async function fetchTopAlbums(period: Period = "1month", limit = 24): Promise<TopAlbum[]> {
  const params = new URLSearchParams({
    method: "user.gettopalbums",
    user: AUDIO_SCROBBLER_USER,
    api_key: AUDIO_SCROBBLER_API_KEY,
    format: "json",
    period,
    limit: String(limit),
  });
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!r.ok) throw new Error(`top albums status ${r.status}`);
    const json: any = await r.json();
    const albums = json?.topalbums?.album ?? [];
    return albums.map((a: any) => ({
      name: a.name ?? "",
      artist: a.artist?.name ?? "",
      playcount: Number(a.playcount ?? 0),
      url: a.url ?? "",
      imageUrl: bestImage(a.image),
    }));
  } catch (err) {
    console.error("Error fetching top albums:", err);
    return [];
  }
}

export async function fetchTopArtists(period: Period = "1month", limit = 10): Promise<TopArtist[]> {
  const params = new URLSearchParams({
    method: "user.gettopartists",
    user: AUDIO_SCROBBLER_USER,
    api_key: AUDIO_SCROBBLER_API_KEY,
    format: "json",
    period,
    limit: String(limit),
  });
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!r.ok) throw new Error(`top artists status ${r.status}`);
    const json: any = await r.json();
    const artists = json?.topartists?.artist ?? [];
    return artists.map((a: any) => ({
      name: a.name ?? "",
      playcount: Number(a.playcount ?? 0),
      url: a.url ?? "",
      imageUrl: bestImage(a.image),
    }));
  } catch (err) {
    console.error("Error fetching top artists:", err);
    return [];
  }
}

export async function fetchUserInfo(): Promise<UserInfo | null> {
  const params = new URLSearchParams({
    method: "user.getinfo",
    user: AUDIO_SCROBBLER_USER,
    api_key: AUDIO_SCROBBLER_API_KEY,
    format: "json",
  });
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!r.ok) throw new Error(`user info status ${r.status}`);
    const json: any = await r.json();
    const u = json?.user;
    if (!u) return null;
    return {
      playcount: Number(u.playcount ?? 0),
      registered: u.registered?.["#text"] ?? "",
      artistCount: Number(u.artist_count ?? 0),
      albumCount: Number(u.album_count ?? 0),
      trackCount: Number(u.track_count ?? 0),
    };
  } catch (err) {
    console.error("Error fetching user info:", err);
    return null;
  }
}
