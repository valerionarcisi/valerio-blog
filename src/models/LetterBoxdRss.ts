import * as S from "@effect/schema/Schema";

export const LetterBoxdRssSchema = S.Struct({
    rss: S.Struct({
        channel: S.Array(
            S.Struct({
                item: S.Array(
                    S.Struct({
                        title: S.Array(S.String),
                        link: S.Array(S.String),
                        description: S.Array(S.String),
                        "tmdb:movieId": S.optional(S.Array(S.String)),
                    })
                )
            }))
    })
})

export type TLetterBoxdRssSchema = S.Schema.Type<typeof LetterBoxdRssSchema>