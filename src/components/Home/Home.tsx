import type { FC } from "react";
import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import type { TPostAbstract } from "../../models/model";

type Props = {
  posts: TPostAbstract[];
};

const Home: FC<Props> = ({ posts }) => {
  return (
    <Box as="section" display="flex" flexDirection="column">
      <Cover
        img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
        title="The Big Lebowski"
      />
      <Box as="div" width="large" margin="auto">
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
