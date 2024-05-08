import * as S from "@effect/schema/Schema";
import type { Exit } from "effect/Exit";
import type { DecodeError } from "../utils/decode";

const TTrackImageSizeSchema = S.Enums({
    small: 'small',
    medium: 'medium',
    large: 'large',
    extralarge: 'extralarge',
    mega: 'mega'
} as const);

export type TTrackImageSize = S.Schema.Type<typeof TTrackImageSizeSchema>;

const TrackImageSchema = S.Struct({
    size: TTrackImageSizeSchema,
    '#text': S.String
})
export type TTrackImage = S.Schema.Type<typeof TrackImageSchema>;

const TrackInfoSchema = S.Struct({
    mbid: S.String,
    '#text': S.String
})
export type TTrackInfo = S.Schema.Type<typeof TrackInfoSchema>;

export const TrackSchema = S.Struct({
    artist: TrackInfoSchema,
    streamable: S.String,
    image: S.Array(TrackImageSchema),
    mbid: S.String,
    album: TrackInfoSchema,
    name: S.String,
    url: S.String
})
export type TTrack = S.Schema.Type<typeof TrackSchema>;

export const RecentTrackSchema = S.Struct({
    recenttracks: S.Struct({
        track: S.Array(TrackSchema)
    })
})

export type ExitTTrack = Exit<TTrack, DecodeError | 'json' | 'get-recent-tracks'>
