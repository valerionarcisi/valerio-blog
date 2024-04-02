import { Effect, pipe } from "effect";
import { AbstractPostSchema, HyGraphPostDetailSchema, HyGraphPostsSchema } from "../models/model";
import { getJson } from "./utils";
import { decodeUnknownEither } from "./decode";

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
    Effect.tap(res => console.log(res.data.post)),
    Effect.flatMap(decodeUnknownEither(HyGraphPostDetailSchema)),
);

export { fetchHyGraph }