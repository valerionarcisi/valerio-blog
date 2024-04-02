import * as S from "@effect/schema/Schema";
import { parseString } from "xml2js";
import { Effect, pipe } from "effect";
import { getText } from "./utils";
import { decodeUnknownEither } from "./decode";
import { RssSchema } from "../models/model";
import { getAndParseMovieById } from "./tmdb";

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