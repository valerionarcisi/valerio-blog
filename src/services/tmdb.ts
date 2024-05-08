import { Effect, pipe } from 'effect';
import { getJson } from '../utils/utils';
import { decodeUnknownEither } from '../utils/decode';
import { MovieTmdbSchema } from '../models';

export const API_KEY = 'a90d99d87d52ef1f55e06af62b50fadc';
export const IMAGES_URL = 'https://image.tmdb.org/t/p/w500';
export const BASE_URL = 'https://api.themoviedb.org/';
export const VERSION = '3';


export const getMovieById = (id: string) => Effect.tryPromise({
    try: () => fetch(`${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`),
    catch: () => "get-movie-by-id" as const,
})


export const getAndParseMovieById = (id: string) => pipe(
    getMovieById(id),
    Effect.flatMap(getJson),
    Effect.flatMap(decodeUnknownEither(MovieTmdbSchema)),
);