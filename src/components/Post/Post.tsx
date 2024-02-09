import { type FC } from "react";
import type { TPost } from "../../models/post.model";
import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import { postBodyStyle } from "./Post.css";
import Tag from "../Tag/Tag";
type Props = {
  post: TPost;
};

const Post: FC<Props> = ({ post }) => {

  const formattedDate = new Date(post.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Box as="article" display="flex" flexDirection="column">
      <Cover
        img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
        title={post.title.rendered}
      />
      <Box as="div">
        <Box as="div" width="large" margin="auto">
          <Typography variant="small">Posted on {formattedDate}</Typography>
          <Box as="div"display={"flex"}>
            <Tag label="javascrip" href="/tags/javascript" />
            <Tag label="movie" href="/tags/javascript" />
            <Tag label="book" href="/tags/javascript" />
          </Box>
          <Box
            as="section"
            className={postBodyStyle}
            dangerouslySetInnerHTML={{ __html: post.content.rendered }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Post;
