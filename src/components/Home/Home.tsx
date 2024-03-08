import type { FC } from "react";
import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import type { TPostAbstract } from "../../models/model";
import { typographyRecipe } from "../Typography/Typography.css";
import clsx from "clsx";
import BoxedTitle from "../Typography/BoxedTitle";

type Props = {
  posts: TPostAbstract[];
};

const Home: FC<Props> = ({ posts }) => {
  return (
    <Box as="section" display="flex" flexDirection="column" width="fullLayout">
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
          In my free time I work as a director and screenwriter.<Box as="br" />
          <Box as="i">
            <Box as="b">
              <Box as="u">Caramella</Box>
            </Box>
          </Box>
          &nbsp;will be my first short film written and directed.
          <Box as="br" />
        </Typography>
      </Box>
      <Box as="hr" width="fullLayout" />
      <Box as="div" display={"flex"} flexDirection={"row"}>
        <Box as="div" width="large">
          <BoxedTitle>
            Last seen, listened to and read...
          </BoxedTitle>
          <Cover
            img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
            title="The Big Lebowski"
          />
        </Box>
        <BoxedTitle>
          I'm currently working on...
        </BoxedTitle>
      </Box>
      <Box as="hr" width="fullLayout" />
      <Box as="div" width="large" margin="auto">
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
          <BoxedTitle as="h3">
            Recent Posts
          </BoxedTitle>
        </Box>
        {posts.map((post) => (
          <Box as="div" key={post.id}>
            <Typography variant="body">
              <h3>
                <a href={`/post/${post.slug}`}>
                  {post.title}
                </a>
              </h3>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Home;
