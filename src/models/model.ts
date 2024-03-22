import { string } from "astro/zod";

export type TTags = Array<string>;
export type TImage = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  filename: string;
};

export type TAutor = {
  name: string;
  picture: TImage;
};

export type TPost = {
  id: string;
  title: string;
  content: string;
  slug: string;
  date: string;
  publishedAt?: string;
  extract?: string;
  createdAt: string;
  tags: TTags;
  coverImage: TImage;
  authors: Array<TAutor>;
};


export enum TTrackImagSize {
  small = 'small',
  medium = 'medium',
  large = 'large',
  extralarge = 'extralarge',
  mega = 'mega'
}

export type TTrackImage = {
  size: TTrackImagSize,
  '#text': string
}

export type TTrackInfo = { mbid: string, '#text': string }

export type TTrack = {
  artist: TTrackInfo,
  streamable: string,
  image: Array<TTrackImage>,
  mbid: string,
  album: TTrackInfo,
  name: string,
  '@attr': { nowplaying: string },
  url: string
}

export type TMovie = {
  original_title: string,
  overview: string,
  link_letterboxd: string,
  poster_path: string,
  release_date: string
}

export type TMovieTmdb = Omit<TMovie, 'link_letterboxd'>


export type THyGraphResponse<K, T> = {
  data?: Record<K extends string ? K : never, T>;
  error?: Error;
}

export type TPage = {
  title: string;
  content: string;
}