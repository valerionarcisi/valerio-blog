import type { FC } from "react";
import Box from "./Box/Box";
import BoxedTitle from "./Typography/BoxedTitle";
import Article from "./Article/Article";
import type { CollectionEntry } from "astro:content";

type Props = {
    posts: CollectionEntry<"posts">[];
    title?: string;
};

const Blog: FC<Props> = ({ posts, title }) => {

    return (
        <Box as="section" width="extraLarge" margin="auto">
            {title && <Box
                as="div"
                display={{
                    mobile: "flex",
                    desktop: "flex",
                    tablet: "flex"
                }}
                flexDirection={{
                    mobile: "column",
                    desktop: "column",
                    tablet: "column"
                }}
                alignItems={{
                    mobile: "center",
                    tablet: "center",
                    desktop: "center"
                }}
                marginTop={{
                    mobile: "large",
                    tablet: "large",
                    desktop: "large"
                }}>
                <BoxedTitle>{title}</BoxedTitle>
            </Box>}
            <Box as="div" width="extraLarge" margin="large" />
            <Box as="div"
                display={{
                    mobile: "flex",
                    desktop: "flex"
                }}
                flexDirection={{
                    mobile: "column",
                    desktop: "column"
                }}
                alignItems={{
                    mobile: "center",
                    desktop: "center"
                }}>
                {posts.map((post) => (<Article key={post.id} post={post} />))}
            </Box>
        </Box>
    );
};

export default Blog;
