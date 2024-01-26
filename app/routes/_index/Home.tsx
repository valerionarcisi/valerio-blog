import { FC } from "react";
import Layout from "~/components/Layout/Layout";
import Typography from "~/components/Typography/Typography";
import Box from "~/components/Box/Box";
import { TPost } from "~/models/post.model";
import { Link } from "@remix-run/react";
import Cover from "~/components/Cover/Cover";

type Props = {
  posts: TPost[];
};

const Home: FC<Props> = ({ posts }) => {
  return (
    <Layout>
      <Box as="section" display="flex" flexDirection="column">
        <Cover
          img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
          title="The Big Lebowski"
        />
        <Box as="div" margin={"auto"}>
          {posts.map((post) => (
            <Box as="div" key={post.id}>
              <Typography variant="body">
                <Link to={`/post/${post.slug}`} prefetch="intent">
                  {post.title.rendered}
                </Link>
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Layout>
  );
};

export default Home;
