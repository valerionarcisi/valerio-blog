import type { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import BoxedTitle from "../Typography/BoxedTitle";
import Card from "../Card/Card";
import Article from "../Article/Article";
import { IMAGES_URL, type TMovieTmdb } from "../../services/tmdb";
import { Match, ReadonlyArray } from "effect";
import type { TPost } from "../../services/hygraph";
import type { TTrack } from "../../services/audioscrobbler";

type Props = {
  posts: TPost[];
  lastTrack?: TTrack;
  lastMovie: TMovieTmdb;
};

const Home: FC<Props> = ({ posts, lastTrack, lastMovie }) => {

  const foundImage = lastTrack?.image?.find((image) => image.size === "extralarge");
  const imgSrc = foundImage ? foundImage["#text"] : 'https://iili.io/HlHpqJ4.md.jpg';

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
          {lastMovie && <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: `${!lastMovie.poster_path ? 'https://iili.io/HlHpqJ4.md.jpg' : `${IMAGES_URL}${lastMovie.poster_path}`}`, alt: lastMovie.original_title }}
              title="Last Watched"
              label={`${lastMovie.original_title}, ${lastMovie.release_date && new Date(lastMovie.release_date).getFullYear()}`}
              description={lastMovie.overview}
              link={`https://letterboxd.com/valenar/films/diary/ `}
            />
          </Box>}
          {lastTrack && <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: imgSrc, alt: `${lastTrack.album["#text"]} Cover` }}
              title="Last played"
              label={lastTrack.name}
              description={`${lastTrack.artist["#text"]} - ${lastTrack.album["#text"]}`}
            />
          </Box>}
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://www.einaudi.it/content/uploads/2023/09/978880625958HIG.JPG", alt: "Stella Maris Cover" }}
              title="Currently reading"
              label="Stella Maris"
              description="Cormarc McCharty (2022)"
            />
          </Box>
        </Box>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      {posts.length > 0 && <Box as="section" width="extraLarge" margin="auto">
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
          {
            Match.value(posts).pipe(
              Match.when(
                ReadonlyArray.isNonEmptyReadonlyArray,
                (posts) => posts.map((post) => <Article post={post} />),
              ),
              Match.orElse(() => <Box as="div" width="fullLayout" margin="large" >Error: Something went wrong</Box>),
            )
          }
        </Box>
      </Box>}
    </Box >
  );
};

export default Home;
