import { Effect, pipe } from "effect";
import { getJson } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";
import { HyGraphPostDetailSchema, HyGraphPostsSchema, HyGraphTagScema } from "../models";

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


export const getAllStaticPathsTags = () => pipe(
  getHyGraph(`{
    posts {
      tags
    }
  }`),
  Effect.flatMap(getJson),
  Effect.flatMap(decodeUnknownEither(HyGraphTagScema)),
  Effect.map(data => [...new Set(data.data.posts.map(post => post.tags?.flatMap(tag => tag)))]),
  Effect.map(data => data.flat().filter(Boolean) as string[]),
  Effect.map(data => data.map(tag => ({ params: { category: tag } }))),
)


export { fetchHyGraph }