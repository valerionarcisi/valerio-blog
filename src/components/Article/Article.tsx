import type { FC } from "react"
import clsx from "clsx"
import Box from "../Box/Box"
import Typography from "../Typography/Typography"
import Tag from "../Tag/Tag"
import { transitionImg } from "./Article.css"
import type { TAbstractPost } from "../../services/hygraph"

type Props = {
    post: TAbstractPost
}


const Article: FC<Props> = ({ post }) => {

    const formattedDate = post?.publishedAt ? new Date(post?.publishedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

    return (
        <Box as="article" key={post.id} display="grid" gridTemplateColumns={1} flexDirection="row"
            marginBottom={{
                mobile: "extraLarge",
                tablet: "extraLarge",
                desktop: "extraLarge"
            }}>
            <Box as="div">
                <a href={`/post/${post.slug}`}>
                    <Box as="img"
                        className={clsx(transitionImg)}
                        borderRadius={{
                            mobile: "small",
                            tablet: "medium",
                            desktop: "medium"
                        }}
                        boxShadow={{
                            mobile: "small",
                            tablet: "medium",
                            desktop: "medium"
                        }}
                        src={`${post.coverImage.url}`}
                        alt={post.title}
                        width="large"
                        marginY={{
                            mobile: "small",
                            tablet: "medium",
                        }}
                    />
                </a>
            </Box>
            <Box as="div" paddingX="large">
                <Box as="h3" marginY={{
                    mobile: "small",
                    tablet: "medium",
                    desktop: "medium"
                }}>
                    <a href={`/post/${post.slug}`}>{post.title}</a>
                </Box>
                {formattedDate && <Typography variant="small">Posted on {formattedDate}</Typography>}
                <Typography variant="small"><Box as="i"> {post.extract} </Box>
                </Typography>

                <Box as="div" display={"flex"}>
                    {post.tags && post.tags.map((tag) => (
                        <Tag key={tag} label={tag} href={`/blog/category/${tag}`} />
                    ))}
                </Box>

            </Box>
        </Box>
    )
}

export default Article
