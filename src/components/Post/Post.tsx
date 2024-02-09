import { type FC } from "react";
import type { TPost } from "../../models/post.model";
import Layout from "../Layout/Layout";
import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import { postBodyStyle } from "./Post.css";
type Props = {
  post: TPost;
};

const Post: FC<Props> = ({ post }) => {


  return (
    <Layout>
      <Box as="article" display="flex" flexDirection="column">
        <Cover
          img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
          title={post.title.rendered}
        />
        <Box as="div">
          <Box as="div" width="large" margin="auto">
            <Box as="div" margin={"auto"} display={"flex"} flexDirection={"column"}>
              <Typography variant="body">Posted on: {post.date}</Typography>
            </Box>
            <Box as="div" margin={"auto"} display={"flex"}>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">javascript</a>
                </Typography>
              </Box>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">movie</a>
                </Typography>
              </Box>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">book</a>
                </Typography>
              </Box>
            </Box>
            <Box
              as="section"
              className={postBodyStyle}
              dangerouslySetInnerHTML={{ __html: post.content.rendered }}
            />
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default Post;
