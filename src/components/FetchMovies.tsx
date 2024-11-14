/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { getLetterboxdRss, parseXmlContent } from "~/services/letterboxd";
import { getMovieById } from "~/services/tmdb";
import Reel from "./Reel";

interface MovieItem {
  "tmdb:movieId"?: string[];
  link: string[];
  "letterboxd:filmTitle": string[];
  "letterboxd:watchedDate": string[];
  poster_path?: string;
  vote_average?: number;
  vote_count?: number;
}

interface ParsedXml {
  rss: {
    channel: [
      {
        item: MovieItem[];
      }
    ];
  };
}

const FetchMovies: React.FC = () => {
  const [lastWatched, setLastWatched] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLastWatchedMovies = async () => {
      try {
        const xml = await getLetterboxdRss();
        const parsedXml = (await parseXmlContent(
          await xml.text()
        )) as ParsedXml;
        const watchedMovies: any[] = [];

        for (const item of parsedXml.rss.channel[0].item) {
          if (!item?.["tmdb:movieId"]?.[0]) continue;
          try {
            const movie = await getMovieById(item["tmdb:movieId"][0]);
            watchedMovies.push({ ...movie, ...item });
          } catch (error) {
            console.error(error);
            console.error(
              `Failed to fetch movie with ID ${item["tmdb:movieId"][0]}`,
              error
            );
            continue;
          }
        }

        setLastWatched(watchedMovies);
      } catch (err) {
        setError("Failed to fetch movies");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLastWatchedMovies();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="ReelContainer">
      {lastWatched.map((movie: any) => (
        <Reel
          key={movie.id}
          type="movie"
          vote_average={movie.vote_average}
          vote_count={movie.vote_count}
          url={`https://image.tmdb.org/t/p/w185/${movie.poster_path}`}
          href={movie.link[0]}
          title={movie["letterboxd:filmTitle"][0]}
          watchedDate={movie["letterboxd:watchedDate"][0]}
        />
      ))}
    </div>
  );
};

export default FetchMovies;
