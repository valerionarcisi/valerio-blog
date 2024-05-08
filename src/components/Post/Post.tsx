import { type FC } from "react";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { materialDark as codeTheme } from 'react-syntax-highlighter/dist/cjs/styles/prism'

import Box from "../Box/Box";
import Cover from "../Cover/Cover";
import Typography from "../Typography/Typography";
import { postBodyStyle } from "./Post.css";
import Tag from "../Tag/Tag";
import type { TPost } from "../../models";


type Props = {
  post: TPost;
};

const Post: FC<Props> = ({ post }) => {

  const formattedDate = post?.publishedAt ? new Date(post?.publishedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  return (
    <Box as="article" display="flex" flexDirection="column">
      <Box as="div" textAlign={"center"}>
        <Typography variant="title">
          {post.title}
        </Typography>
      </Box>
      <Box as="div" margin="auto">
        <Cover
          img={{ src: `${post.coverImage?.url}`, alt: `${post.title}` }}
        />
      </Box>
      <Box as="div">
        <Box as="div" width="large" margin="auto">
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
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const { children, className, node, ...rest } = props
                  return (
                    <SyntaxHighlighter
                      {...rest}
                      PreTag="div"
                      children={String(children).replace(/\n$/, '')}
                      language={`javascript`}
                      style={codeTheme}
                      ref={(ref) => {
                        if (ref) {
                          if (ref instanceof HTMLElement) {
                            const htmlElementRef = ref as HTMLElement;
                            (ref as any).ref = htmlElementRef;
                          }
                        }
                      }}
                    />
                  )
                }
              }}
            >{post.content}</Markdown>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Post;
