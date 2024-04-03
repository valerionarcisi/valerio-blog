import type { FC } from "react";
import Box from "../Box/Box";
import Article from "../Article/Article";
import BoxedTitle from "../Typography/BoxedTitle";
import type { TPost } from "../../services/hygraph";

type Props = {
    posts: TPost[];
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
                {posts.map((post) => (
                    <Article key={post.id} post={post} />
                ))}
            </Box>
        </Box>
    );
};

export default Blog;
