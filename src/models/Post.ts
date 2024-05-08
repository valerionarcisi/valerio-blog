import * as S from "@effect/schema/Schema";
import type { Exit } from "effect/Exit";
import { ImageSchema } from "./Image";
import { AuthorSchema } from "./Author";
import { HyGraphResponseSchema } from "./HyGraphResponse";
import { AbstractPostSchema } from "./AbstractPost";

const PostSchema = S.Struct({
    id: S.String,
    title: S.String,
    content: S.String,
    slug: S.String,
    date: S.String,
    publishedAt: S.optional(S.String),
    extract: S.optional(S.String),
    createdAt: S.optional(S.String),
    tags: S.Array(S.String),
    coverImage: ImageSchema,
    authors: S.Array(AuthorSchema)
});

export type TPost = S.Schema.Type<typeof PostSchema>;

export const HyGraphPostDetailSchema = S.Struct({
    ...HyGraphResponseSchema.fields,
    data: S.Struct({
        post: PostSchema,
    }),
})

export const HyGraphPostsSchema = S.Struct({
    ...HyGraphResponseSchema.fields,
    data: S.Struct({
        posts: S.Array(AbstractPostSchema),
    }),
})

export type ExitTPost = Exit<TPost, "json" | "get-hygraph">
