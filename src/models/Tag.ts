import * as S from "@effect/schema/Schema";
import type { Exit } from "effect/Exit";

const TagsSchema = S.Array(S.String);
type TTags = S.Schema.Type<typeof TagsSchema>;

export type ExitTAllTags = Exit<String[], "json" | "get-hygraph">


export const HyGraphTagScema = S.Struct({
    data: S.Struct({
        posts: S.Array(
            S.Struct({
                tags: S.Array(S.String),
            })
        ),
    }),
})

export { type TTags, TagsSchema }