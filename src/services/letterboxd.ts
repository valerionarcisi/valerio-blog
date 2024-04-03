import * as S from "@effect/schema/Schema";
import { parseString } from "xml2js";
import { Effect, pipe } from "effect";
import { getText } from "../utils/utils";
import { decodeUnknownEither } from "../utils/decode";
import { getAndParseMovieById } from "./tmdb";


export const RssSchema = S.struct({
    rss: S.struct({
        channel: S.array(
            S.struct({
                item: S.array(
                    S.struct({
                        title: S.array(S.string),
                        link: S.array(S.string),
                        description: S.array(S.string),
                        "tmdb:movieId": S.optional(S.array(S.string)),
                    })
                )
            }))
    })
})

export type TRss = S.Schema.Type<typeof RssSchema>

const parseXmlContent = (xmlContent: string): Promise<unknown> =>
    new Promise((resolve, reject) => {
        parseString(xmlContent, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

export const runParseXmlContent = (xml: string) => Effect.tryPromise({
    try: () => parseXmlContent(xml),
    catch: () => "parse-xml" as const,
})
export const runParseAndDecodeXmlContent = (xml: string) => pipe(
    runParseXmlContent(xml),
    Effect.map(data => data),
    Effect.flatMap(decodeUnknownEither(RssSchema)),
)

export const getLetterboxdRss = () => Effect.tryPromise({
    try: () => fetch("https://letterboxd.com/valenar/rss/"),
    catch: () => "get-letterboxd-rss" as const,
})

export const getAndParseLetterboxdRss = () => pipe(
    getLetterboxdRss(),
    Effect.flatMap(getText),
    Effect.flatMap(decodeUnknownEither(S.string)),
)

export const program = Effect.gen(function* (_) {
    
    const xml = yield* _(getAndParseLetterboxdRss())
    const json = yield* _(runParseAndDecodeXmlContent(xml))
    
    if (json.rss.channel[0].item[0]["tmdb:movieId"] !== undefined) {
        return yield* _(getAndParseMovieById(json.rss.channel[0].item[0]["tmdb:movieId"][0]))
    }

    return {
        original_title: "No movie found",
        overview: "No movie found",
        release_date: "",
        poster_path: "",
    }
})