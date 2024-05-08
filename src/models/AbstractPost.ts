import * as S from "@effect/schema/Schema";
import type { Exit } from "effect/Exit";

export const AbstractPostSchema = S.Struct({
    id: S.String,
    title: S.String,
    slug: S.String,
    publishedAt: S.optional(S.String),
    extract: S.NullOr(S.String),
    tags: S.optional(S.Array(S.String)),
    coverImage: S.Struct({
        id: S.String,
        url: S.String,
        fileName: S.String,
    }),
})
export type TAbstractPost = S.Schema.Type<typeof AbstractPostSchema>

export type ExitTAbstractPost = Exit<TAbstractPost[], "json" | "get-hygraph">
