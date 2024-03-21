import type { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import type { TMovieTmdb, TPost, TTrack } from "../../models/model";
import BoxedTitle from "../Typography/BoxedTitle";
import Card from "../Card/Card";
import Article from "../Article/Article";
import { IMAGES_URL } from "../../utils/tmdb";

type Props = {
  posts: TPost[];
  lastTrack: TTrack;
  lastMovie: TMovieTmdb;
};

const Home: FC<Props> = ({ posts, lastTrack, lastMovie }) => {

  const foundImage = lastTrack?.image?.find((image) => image.size === "extralarge");
  const imgSrc = foundImage ? foundImage["#text"] : '';

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
            desktop: "row"
          }}
          justifyContent="center">
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: `${IMAGES_URL}/${lastMovie.poster_path}`, alt: lastMovie.original_title }}
              title="Last Watched"
              label={`${lastMovie.original_title}, ${new Date(lastMovie.release_date).getFullYear()}`}
              description={lastMovie.overview}
              link={`https://letterboxd.com/valenar/films/diary/ `}
            />
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: imgSrc, alt: `${lastTrack.album["#text"]} Cover` }}
              title="Last played"
              label={lastTrack.album["#text"]}
              description={lastTrack.artist["#text"]}
            />
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcdn.kobo.com%2Fbook-images%2F3fb0f98a-caee-4f36-ac94-2f858214b684%2F1200%2F1200%2FFalse%2Fstella-maris-36.jpg&f=1&nofb=1&ipt=aba325685c233e51620de1d6053226c12d8839d1f6fb00815c6c786cb6fa2d6c&ipo=images", alt: "Stella Maris Cover" }}
              title="Currently reading"
              label="Stella Maris"
              description="Cormarc McCharty (2022)"
            />
          </Box>
        </Box>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      {posts.length > 0 && <Box as="section" width="extraLarge" margin="auto">
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center" marginBottom="extraLarge">
          <BoxedTitle as="h3">
            Recent Posts
          </BoxedTitle>
        </Box>
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
          {posts.map((post) => (
            <Article key={post.id} post={post} />
          ))}
        </Box>
      </Box>}
    </Box >
  );
};

export default Home;
