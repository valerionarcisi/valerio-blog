import { Effect, pipe } from 'effect';
import { MovieTmdbSchema, type TMovieTmdb } from "../models/model";
import { getJson } from './utils';
import { decodeUnknownEither } from './decode';

export const API_KEY = 'a90d99d87d52ef1f55e06af62b50fadc';
export const IMAGES_URL = 'https://image.tmdb.org/t/p/w500';
export const BASE_URL = 'https://api.themoviedb.org/';
export const VERSION = '3';

export const fetchMovieById = async (id: string): Promise<TMovieTmdb> => {
    const url = `${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    return data
};


export const getMovieById = (id: string) => Effect.tryPromise({
    try: () => fetch(`${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`),
    catch: () => "fetch" as const,
})


export const getAndParseMovieById = (id: string) => pipe(
    getMovieById(id),
    Effect.flatMap(getJson),
    Effect.flatMap(decodeUnknownEither(MovieTmdbSchema)),
);