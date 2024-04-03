import { Effect, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import { getJson } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";

const TagsSchema = S.array(S.string);
export type TTags = S.Schema.Type<typeof TagsSchema>;

const ImageSchema = S.struct({
    id: S.optional(S.string),
    url: S.string,
    width: S.optional(S.number),
    height: S.optional(S.number),
    filename: S.optional(S.string)
})
export type TImage = S.Schema.Type<typeof ImageSchema>;

const AuthorSchema = S.struct({
    name: S.string,
    picture: ImageSchema
})
export type TAuthor = S.Schema.Type<typeof AuthorSchema>;


const PostSchema = S.struct({
    id: S.string,
    title: S.string,
    content: S.string,
    slug: S.string,
    date: S.string,
    publishedAt: S.optional(S.string),
    extract: S.optional(S.string),
    createdAt: S.optional(S.string),
    tags: S.array(S.string),
    coverImage: ImageSchema,
    authors: S.array(AuthorSchema)
});

export type TPost = S.Schema.Type<typeof PostSchema>;

export const HyGraphResponseSchema = S.struct({
    data: S.record(S.string, S.unknown),
    error: S.optional(S.string)
})

export const AbstractPostSchema = S.struct({
    id: S.string,
    title: S.string,
    slug: S.string,
    publishedAt: S.optional(S.string),
    extract: S.nullable(S.string),
    tags: S.optional(S.array(S.string)),
    coverImage: S.struct({
        id: S.string,
        url: S.string,
        fileName: S.string,
    }),
})

export const HyGraphPostsSchema = S.struct({
    ...HyGraphResponseSchema.fields,
    data: S.optional(
        S.struct({
            posts: S.array(AbstractPostSchema),
        })),
})

export const HyGraphPostDetailSchema = S.struct({
    ...HyGraphResponseSchema.fields,
    data: S.optional(
        S.struct({
            post: PostSchema,
        })),
})

export type THyGraphResponse<K, T> = {
    data?: Record<K extends string ? K : never, T>;
    error?: Error;
}

const PageSchema = S.struct({
    title: S.string,
    content: S.string
})
export type TPage = S.Schema.Type<typeof PageSchema>


const fetchHyGraph = (query: string): Promise<Response> => {
    const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query,
        }),
    };
    return fetch(import.meta.env.HYGRAPH_ENDPOINT, request);
}


const getHyGraph = (query: string) => Effect.tryPromise({
    try: () => fetchHyGraph(query),
    catch: () => "get-hygraph" as const,
})


export const getAndParseHyAllPosts = (query: string) => pipe(
    getHyGraph(query),
    Effect.flatMap(getJson),
    Effect.flatMap(decodeUnknownEither(HyGraphPostsSchema)),
);

export const getAndParsePostDetail = (query: string) => pipe(
    getHyGraph(query),
    Effect.flatMap(getJson),
    Effect.flatMap(decodeUnknownEither(HyGraphPostDetailSchema)),
);

export { fetchHyGraph }