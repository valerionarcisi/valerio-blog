import type { FC } from "react";
import { Match } from "effect";
import type { Exit } from "effect/Exit";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import BoxedTitle from "../Typography/BoxedTitle";
import Card from "../Card/Card";
import Article from "../Article/Article";
import { IMAGES_URL, type TMovieTmdb } from "../../services/tmdb";
import type { TTrack } from "../../services/audioscrobbler";
import type { DecodeError } from "../../utils/decode";
import type { ExitTAbstractPost } from "../../services/hygraph";

type ExitTMovie = Exit<TMovieTmdb, DecodeError | 'json' | "get-letterboxd-rss" | "text" | "parse-xml" | "get-movie-by-id">
type ExitTTrack = Exit<TTrack, DecodeError | 'json' | 'get-recent-tracks'>

type Props = {
  posts: ExitTAbstractPost;
  lastTrack: ExitTTrack;
  lastMovie: ExitTMovie;
};

const Home: FC<Props> = ({ posts, lastTrack, lastMovie }) => {

  const musicMatch = Match.typeTags<ExitTTrack>()({
    Success: ({ value }) => (<Card
      img={
        {
          src: value.image?.find((image) => image.size === "extralarge")?.["#text"] ?? 'https://iili.io/HlHpqJ4.md.jpg',
          alt: `${value.album["#text"]} Cover`
        }
      }
      title="Last played"
      label={value.name}
      description={`${value.artist["#text"]} - ${value.album["#text"]}`}
    />),
    Failure: () => (<Card
      img={{ src: 'https://iili.io/HlHpqJ4.md.jpg', alt: `Not Found Cover` }}
      title="Last played"
      label="Missing track"
      description="No track played yet"
    />)
  });


  const movieMatch = Match.typeTags<ExitTMovie>()({
    Success: ({ value }) => (<Card
      img={{ src: `${!value.poster_path ? 'https://iili.io/HlHpqJ4.md.jpg' : `${IMAGES_URL}${value.poster_path}`}`, alt: value.original_title }}
      title="Last Watched"
      label={`${value.original_title}, ${value.release_date && new Date(value.release_date).getFullYear()}`}
      description={value.overview}
      link={`https://letterboxd.com/valenar/films/diary/ `}
    />),
    Failure: () => (<Card
      img={{ src: 'https://iili.io/HlHpqJ4.md.jpg', alt: `Not Found Cover` }}
      title="Last played"
      label="Missing track"
      description="No track played yet"
    />)
  });

  const postsMatch = Match.typeTags<ExitTAbstractPost>()({
    Success: ({ value }) => (value.map((post) => (<Article key={post.id} post={post} />))),
    Failure: () => (<>Something went wrong</>),
  })


  return (
    <Box as="div" display="flex" flexDirection="column" width="fullLayout">
      <Box as="div" width="extraLarge">
        <Typography variant="title">
          <BoxedTitle as="span">
            Hi I'm Valerio
          </BoxedTitle>
        </Typography>
        <Typography variant="title">
          I'm a web developer, director and screenwriter.
        </Typography>
        <Typography variant="subtitle">
          I currently work at <Box as="a" target="_blank" href="https://cleafy.com">.Cleafy</Box> as a frontend developer. <br />
        </Typography>
        <Typography variant="description">
          Over the past year I've been strengthening my knowledge on refactoring large PHP apps into modern Javascript. I'm working with JS, React, Redux, Angular, Typescript and Node.js.        </Typography>
        <Typography variant="description">
          In my free time I work as a director and screenwriter.<Box as="br" />
          <Box as="i">Caramella</Box> will be my first short film.
        </Typography>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      <Box as="section">
        <Box
          as="div"
          display={"flex"}
          flexDirection={{
            mobile: "column",
            tablet: "column",
            desktop: "row"
          }}
          justifyContent="center">
          <Box as="div" width="medium" paddingX={"large"}>
            {movieMatch(lastMovie)}
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            {musicMatch(lastTrack)}
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://www.ibs.it/images/9788806235017_0_536_0_75.jpg", alt: "4 3 2 1 Cover" }}
              title="on reading"
              label="4 3 2 1"
              description="Paul Auster (2017)"
            />
          </Box>
        </Box>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      <Box as="section" width="extraLarge" margin="auto">
        <Box
          as="div"
          display={{
            mobile: "flex",
            desktop: "flex",
            tablet: "flex"
          }}
          flexDirection={{
            mobile: "column",
            desktop: "column",
            tablet: "column"
          }}
          alignItems={{
            mobile: "center",
            desktop: "center",
            tablet: "center"
          }}
          marginBottom={
            {
              mobile: "large",
              desktop: "extraLarge",
              tablet: "large"
            }
          }
        >
          <BoxedTitle as="h3">
            Recent Posts
          </BoxedTitle>
        </Box>
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
          {postsMatch(posts)}
        </Box>
      </Box>
    </Box >
  );
};

export default Home;
