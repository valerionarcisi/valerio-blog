export const API_KEY = import.meta.env.TMDB_API_KEY;
export const IMAGES_URL = 'https://image.tmdb.org/t/p/w500';
export const BASE_URL = 'https://api.themoviedb.org/';
export const VERSION = '3';

export const getMovieById = async (id: string): Promise<Response> => {
  try {
    const response = await fetch(
      `${BASE_URL}${VERSION}/movie/${id}?api_key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch movie with ID ${id}. Status: ${response.status}`
      );
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching movie by ID:', error);
    throw error;
  }
};
