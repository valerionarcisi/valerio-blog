import { Effect, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import { getJson } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";

export const AUDIO_SCROBBLER_API_KEY = "35dcb09bbc9c0e8bee54210bace4ba66";
export const AUDIO_SCROBBLER_USER = "valerionar";
export const AUDIO_SCROBBLER_VERSION = '2.0';

const TTrackImageSizeSchema = S.enums({
    small: 'small',
    medium: 'medium',
    large: 'large',
    extralarge: 'extralarge',
    mega: 'mega'
} as const);

export type TTrackImageSize = S.Schema.Type<typeof TTrackImageSizeSchema>;

const TrackImageSchema = S.struct({
    size: TTrackImageSizeSchema,
    '#text': S.string
})
export type TTrackImage = S.Schema.Type<typeof TrackImageSchema>;

const TrackInfoSchema = S.struct({
    mbid: S.string,
    '#text': S.string
})
export type TTrackInfo = S.Schema.Type<typeof TrackInfoSchema>;

export const TrackSchema = S.struct({
    artist: TrackInfoSchema,
    streamable: S.string,
    image: S.array(TrackImageSchema),
    mbid: S.string,
    album: TrackInfoSchema,
    name: S.string,
    url: S.string
})
export type TTrack = S.Schema.Type<typeof TrackSchema>;

export const RecentTrackSchema = S.struct({
    recenttracks: S.struct({
        track: S.array(TrackSchema)
    })
})


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