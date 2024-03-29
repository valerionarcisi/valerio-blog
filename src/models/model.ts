import * as S from "@effect/schema/Schema";

const Tags = S.array(S.string);
export type TTags = S.Schema.Type<typeof Tags>;

const Image = S.struct({
  id: S.string,
  url: S.string,
  width: S.optional(S.number),
  height: S.optional(S.number),
  filename: S.string
})
export type TImage = S.Schema.Type<typeof Image>;

const Author  = S.struct({
  name: S.string,
  picture: Image
})
export type TAuthor = S.Schema.Type<typeof Author>;


const Post = S.struct({
  id: S.string,
  title: S.string,
  content: S.string,
  slug: S.string,
  date: S.string,
  publishedAt: S.optional(S.string),
  extract: S.optional(S.string),
  createdAt: S.string,
  tags: S.array(S.string),
  coverImage: Image,
  authors: S.array(Author)
});
export type TPost = S.Schema.Type<typeof Post>;

const TTrackImageSize = S.union(S.literal('small'), S.literal('medium'), S.literal('large'), S.literal('extralarge'), S.literal('mega'));
export type TTrackImageSize = S.Schema.Type<typeof TTrackImageSize>;

// export enum TTrackImagSize {
//   small = 'small',
//   medium = 'medium',
//   large = 'large',
//   extralarge = 'extralarge',
//   mega = 'mega'
// }

const TrackImage = S.struct({
  size: TTrackImageSize,
  '#text': S.string
})
export type TTrackImage = S.Schema.Type<typeof TrackImage>;

const TrackInfo = S.struct({
  mbid: S.string,
  '#text': S.string
})
export type TTrackInfo = S.Schema.Type<typeof TrackInfo>;

const Track = S.struct({
  artist: TrackInfo,
  streamable: S.string,
  image: S.array(TrackImage),
  mbid: S.string,
  album: TrackInfo,
  name: S.string,
  '@attr': S.struct({ nowplaying: S.string }),
  url: S.string
})
export type TTrack = S.Schema.Type<typeof Track>;

const Movie = S.struct({
  original_title: S.string,
  overview: S.string,
  link_letterboxd: S.string,
  poster_path: S.string,
  release_date: S.string
})
export type TMovie = S.Schema.Type<typeof Movie>;

const MovieTmdb =  Movie.pipe(S.omit('link_letterboxd'))
export type TMovieTmdb = S.Schema.Type<typeof MovieTmdb>

export type THyGraphResponse<K, T> = {
  data?: Record<K extends string ? K : never, T>;
  error?: Error;
}

const Page = S.struct({
  title: S.string,
  content: S.string
})
export type TPage = S.Schema.Type<typeof Page>
