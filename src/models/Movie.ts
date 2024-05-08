import * as S from "@effect/schema/Schema";
import type { Exit } from "effect/Exit";
import type { DecodeError } from "../utils/decode";


const MovieSchema = S.Struct({
    original_title: S.String,
    overview: S.String,
    link_letterboxd: S.String,
    poster_path: S.String,
    release_date: S.String
})
export type TMovie = S.Schema.Type<typeof MovieSchema>;

export const MovieTmdbSchema = MovieSchema.pipe(S.omit('link_letterboxd'))
export type TMovieTmdb = S.Schema.Type<typeof MovieTmdbSchema>
export type ExitTMovie = Exit<TMovieTmdb, DecodeError | 'json' | "get-letterboxd-rss" | "text" | "parse-xml" | "get-movie-by-id">
