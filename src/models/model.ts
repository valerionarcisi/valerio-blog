import * as S from "@effect/schema/Schema";

const TagsSchema = S.array(S.string);
export type TTags = S.Schema.Type<typeof TagsSchema>;

const ImageSchema = S.struct({
  id: S.optional(S.string),
  url: S.string,
  width: S.optional(S.number),
  height: S.optional(S.number),
  filename: S.optional(S.string)
})
export type TImage = S.Schema.Type<typeof ImageSchema>;

const AuthorSchema = S.struct({
  name: S.string,
  picture: ImageSchema
})
export type TAuthor = S.Schema.Type<typeof AuthorSchema>;


const PostSchema = S.struct({
  id: S.string,
  title: S.string,
  content: S.string,
  slug: S.string,
  date: S.string,
  publishedAt: S.optional(S.string),
  extract: S.optional(S.string),
  createdAt: S.string,
  tags: S.array(S.string),
  coverImage: ImageSchema,
  authors: S.array(AuthorSchema)
});

export type TPost = S.Schema.Type<typeof PostSchema>;

const TTrackImageSizeSchema = S.enums({
  small: 'small',
  medium: 'medium',
  large: 'large',
  extralarge: 'extralarge',
  mega: 'mega'
} as const);

export type TTrackImageSize = S.Schema.Type<typeof TTrackImageSizeSchema>;

const TrackImageSchema = S.struct({
  size: TTrackImageSizeSchema,
  '#text': S.string
})
export type TTrackImage = S.Schema.Type<typeof TrackImageSchema>;

const TrackInfoSchema = S.struct({
  mbid: S.string,
  '#text': S.string
})
export type TTrackInfo = S.Schema.Type<typeof TrackInfoSchema>;

export const TrackSchema = S.struct({
  artist: TrackInfoSchema,
  streamable: S.string,
  image: S.array(TrackImageSchema),
  mbid: S.string,
  album: TrackInfoSchema,
  name: S.string,
  url: S.string
})
export type TTrack = S.Schema.Type<typeof TrackSchema>;

export const RecentTrackSchema = S.struct({
  recenttracks: S.struct({
    track: S.array(TrackSchema)
  })
})


const MovieSchema = S.struct({
  original_title: S.string,
  overview: S.string,
  link_letterboxd: S.string,
  poster_path: S.string,
  release_date: S.string
})
export type TMovie = S.Schema.Type<typeof MovieSchema>;

export const MovieTmdbSchema = MovieSchema.pipe(S.omit('link_letterboxd'))
export type TMovieTmdb = S.Schema.Type<typeof MovieTmdbSchema>

export const HyGraphResponseSchema = S.struct({
  data: S.record(S.string, S.unknown),
  error: S.optional(S.string)
})

export const AbstractPostSchema = S.struct({
  id: S.string,
  title: S.string,
  slug: S.string,
  publishedAt: S.optional(S.string),
  extract: S.nullable(S.string),
  tags: S.optional(S.array(S.string)),
  coverImage: S.struct({
    id: S.string,
    url: S.string,
    fileName: S.string,
  }),
})


export const HyGraphPostsSchema = S.struct({
  ...HyGraphResponseSchema.fields,
  data: S.optional(
    S.struct({
      posts: S.array(AbstractPostSchema),
    })),
})

export const HyGraphPostDetailSchema = S.struct({
  ...HyGraphResponseSchema.fields,
  data: S.optional(
    S.struct({
      post: PostSchema,
    })),
})

export type THyGraphResponse<K, T> = {
  data?: Record<K extends string ? K : never, T>;
  error?: Error;
}

const PageSchema = S.struct({
  title: S.string,
  content: S.string
})
export type TPage = S.Schema.Type<typeof PageSchema>


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