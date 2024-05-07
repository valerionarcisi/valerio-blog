import { Effect, pipe } from "effect";
import type { Exit } from "effect/Exit";
import * as S from "@effect/schema/Schema";
import { getJson } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";

const TagsSchema = S.Array(S.String);
export type TTags = S.Schema.Type<typeof TagsSchema>;

const ImageSchema = S.Struct({
  id: S.optional(S.String),
  url: S.String,
  width: S.optional(S.Number),
  height: S.optional(S.Number),
  filename: S.optional(S.String)
})
export type TImage = S.Schema.Type<typeof ImageSchema>;

const AuthorSchema = S.Struct({
  name: S.String,
  picture: ImageSchema
})
export type TAuthor = S.Schema.Type<typeof AuthorSchema>;


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

export const HyGraphResponseSchema = S.Struct({
  data: S.Record(S.String, S.Unknown),
  error: S.optional(S.String)
})

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

export const HyGraphPostsSchema = S.Struct({
  ...HyGraphResponseSchema.fields,
  data: S.Struct({
    posts: S.Array(AbstractPostSchema),
  }),
})

export const HyGraphPostDetailSchema = S.Struct({
  ...HyGraphResponseSchema.fields,
  data: S.Struct({
    post: PostSchema,
  }),
})

export type THyGraphResponse<K, T> = {
  data?: Record<K extends string ? K : never, T>;
  error?: Error;
}

const PageSchema = S.Struct({
  title: S.String,
  content: S.String
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


export const getAndParseHyGraph = (query: string) => pipe(
  getHyGraph(query),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphPostsSchema)),
);

export const getAndParseHyGraphAbstractPost = (last?: number) => pipe(
  getHyGraph(`{
      posts(orderBy: publishedAt_DESC ${last ? `last:${last.toString()}` : ""}) {
        id,
        title,
        slug,
        publishedAt,
        tags,
        extract
        createdAt
        coverImage {
          id,
          url,
          fileName,
        }
      }
    }
  `),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphPostsSchema)),
  Effect.map(data => data.data.posts),
)

export const getAndParseHyGraphAbstractPostByCategory = (category: string) => pipe(
  getHyGraph(`{
  posts(orderBy: publishedAt_DESC, where: {tags_contains_some: "${category}"}) {
        id,
        title,
        slug,
        publishedAt,
        tags,
        extract
        coverImage {
          id,
          url,
          fileName,
        }
      }
    }
  `),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphPostsSchema)),
  Effect.map(data => data.data.posts),
)

export const getAndParsePostDetail = (slug: string) => pipe(
  getHyGraph(`{
      post(where: {slug: "${slug}"}) {
        title
        id
        slug
        publishedAt
        content
        date
        tags
        extract
        authors {
          name
          picture {
            url
            fileName
          }
        }
        coverImage {
          fileName
          url
          height
          width
        }
      }
    }
  `),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphPostDetailSchema)),
  Effect.map(data => data.data.post),
);

export type ExitTAbstractPost = Exit<TAbstractPost[], "json" | "get-hygraph">
export type ExitTPost = Exit<TPost, "json" | "get-hygraph">

export const getAndParseAllTags = () => pipe(
  getHyGraph(`{
    posts {
      tags
    }
  }`),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphPostsSchema)),
  Effect.map(data => [...new Set(data.data.posts.map(post => post.tags?.flatMap(tag => tag)))]),
  Effect.map(data => data.flat().filter(Boolean) as string[]),
)

export type ExitTAllTags = Exit<String[], "json" | "get-hygraph">


export { fetchHyGraph }