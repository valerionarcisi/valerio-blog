import { Effect, pipe } from "effect";
import { getJson } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";
import { RecentTrackSchema, TrackSchema } from "../models";

export const AUDIO_SCROBBLER_API_KEY = "35dcb09bbc9c0e8bee54210bace4ba66";
export const AUDIO_SCROBBLER_USER = "valerionar";
export const AUDIO_SCROBBLER_VERSION = '2.0';


export const fetchRecentTracks = (method = "user.getrecenttracks", format = "json", limit = "1"): Promise<Response> => {

    const params = new URLSearchParams();
    params.append("method", method);
    params.append("user", AUDIO_SCROBBLER_USER);
    params.append("api_key", AUDIO_SCROBBLER_API_KEY);
    params.append("format", format);
    params.append("limit", limit);
    return fetch(`http://ws.audioscrobbler.com/2.0/?${params.toString()}`);
}


export const getRecentTraks = (method = "user.getrecenttracks", format = "json", limit = "1") => Effect.tryPromise({
    try: () => fetchRecentTracks(method, format, limit),
    catch: () => "get-recent-tracks" as const,
})

export const getAndParseRecentTraks = (method = "user.getrecenttracks", format = "json", limit = "1") => pipe(
    getRecentTraks(method, format, limit),
    Effect.flatMap(getJson),
    Effect.flatMap(decodeUnknownEither(RecentTrackSchema)),
)

export const getAndParseRecentTrack = () => pipe(
   getAndParseRecentTraks(),
   Effect.map(data => data.recenttracks.track[0]),
   Effect.flatMap(decodeUnknownEither(TrackSchema)), 
)