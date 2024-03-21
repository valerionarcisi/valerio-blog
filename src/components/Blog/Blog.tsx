import type { FC } from "react";
import Box from "../Box/Box";
import type { TPost } from "../../models/model";
import Article from "../Article/Article";
import Typography from "../Typography/Typography";
import BoxedTitle from "../Typography/BoxedTitle";

type Props = {
    posts: TPost[];
    title?: string;
};

const Blog: FC<Props> = ({ posts, title }) => {
    return (
        <Box as="section" width="extraLarge" margin="auto">
            {title && <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center" marginTop="large">
                <BoxedTitle>{title}</BoxedTitle>
            </Box>}
            <Box as="div" width="extraLarge" margin="large" />
            <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
                {posts.map((post) => (
                    <Article key={post.id} post={post} />
                ))}
            </Box>
        </Box>
    );
};

export default Blog;
