import type { CollectionEntry } from "astro:content"
import type { FC } from "react"
import clsx from "clsx"
import Box from "../Box/Box"
import Typography from "../Typography/Typography"
import Tag from "../Tag/Tag"
import { transitionImg } from "./Article.css"

type Props = {
    post: CollectionEntry<"posts">
}


const Article: FC<Props> = ({ post }) => {
    const formattedDate = post.data.createdAt ? new Date(post.data.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

    const getExtract = (extract: string | null): string => {
        if (!extract) return "";
        return extract.length > 100 ? extract.slice(0, 97) + "..." : extract
    }

    return (
        <Box as="article" key={post.data.title} display="grid" gridTemplateColumns={1} flexDirection="row"
            marginBottom={{
                mobile: "extraLarge",
                tablet: "extraLarge",
                desktop: "extraLarge"
            }}>
            <Box as="div">
                <a href={`/posts/${post.slug}`}>
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
                        src={`${post.data.cover}`}
                        alt={post.data.title}
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
                    <a href={`/posts/${post.slug}`}>{post.data.title}</a>
                </Box>
                {formattedDate && <Typography variant="small">Posted on {formattedDate}</Typography>}
                <Typography variant="small"><Box as="i"> {getExtract(post?.data.extract)}
                </Box>
                </Typography>

                <Box as="div" display={"flex"}>
                    {post.data.tags && post.data.tags.map((tag) => (
                        <Tag key={tag} label={tag} href={`/blog/category/${tag}`} />
                    ))}
                </Box>

            </Box>
        </Box>
    )
}

export default Article
