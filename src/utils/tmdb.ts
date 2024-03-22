import type { TMovieTmdb } from "../models/model";

export const API_KEY = 'a90d99d87d52ef1f55e06af62b50fadc';
export const IMAGES_URL = 'https://image.tmdb.org/t/p/w500';
export const BASE_URL = 'https://api.themoviedb.org/';
export const VERSION = '3';

export const fetchMovieById = (id: string): Promise<TMovieTmdb> => {
    const url = `${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`;

    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .catch((error) => {
            console.error("There was a problem with your fetch operation:", error);
        });
};