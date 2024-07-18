import { type FC } from "react";
import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import { postBodyStyle } from "./Post.css";
import Tag from "../Tag/Tag";
import type { TPostMD } from "../../models";
import BoxedTitle from "../Typography/BoxedTitle";


type Props = {
  post: TPostMD;
  children: React.ReactNode
};

const Post: FC<Props> = ({ post, children }) => {

  const formattedDate = post?.createdAt ? new Date(post?.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  return (
    <Box as="article" display="flex" flexDirection="column">
      <Box as="div" textAlign={"center"} marginY={{
        mobile: "large",
        tablet: "large",
        desktop: "large"
      }}>
        <Typography variant="title">
          <BoxedTitle as="span">
            {post.title}
          </BoxedTitle>
        </Typography>
      </Box>
      <Box as="div" margin="auto">
        <Cover
          img={{ src: `${post.cover}`, alt: `${post.title}` }}
        />
      </Box>
      <Box as="div">
        <Box as="div" width="large" margin="auto">
          <Box as="hr" />

          {formattedDate && <Typography variant="small">Posted on {formattedDate}</Typography>}
          <Box as="div" display={"flex"}>
            {post?.tags?.map((tag) => (
              <Tag key={tag} label={tag} href={`/blog/category/${tag}`} />
            ))}
          </Box>
          <Box
            as="section"
            className={postBodyStyle}
          >
            {post.cover && post.coverAuthor && post.coverLinkSource && <Box
              as="div"
            >
              Cover by <Box as="a" href={post.coverLinkSource} target="_blank">{post.coverAuthor}</Box>
            </Box>
            }
            <Box as="hr" />
            {children}
            <Box as="hr" />
            <Box as="div" marginY={{
              mobile: "large",
              tablet: "large",
              desktop: "large"
            }}>
              Contact me: <a href="mailto:valerio.narcisi@gmail.com">valerio.narcisi@gmail.com </a>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Post;
