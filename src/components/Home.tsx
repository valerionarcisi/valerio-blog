import type { FC } from "react";
import { Match } from "effect";
import Box from "./Box/Box";
import BoxedTitle from "./Typography/BoxedTitle";
import Card from "./Card/Card";
import Article from "./Article/Article";
import { IMAGES_URL } from "../services/tmdb";
import type { ExitTMovie, ExitTTrack } from "../models";
import type { CollectionEntry } from "astro:content";
import Hero from "./Hero/Hero";


type Props = {
  posts: CollectionEntry<"posts">[];
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


  return (
    <Box as="div" display="flex" flexDirection="column" width="fullLayout">
      <Hero />
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
          {posts.map((post) => (<Article key={post.id} post={post} />))}
        </Box>
      </Box>
    </Box >
  );
};

export default Home;
