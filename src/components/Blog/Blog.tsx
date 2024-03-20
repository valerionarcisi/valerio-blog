import type { FC } from "react";
import Box from "../Box/Box";
import type { TPost } from "../../models/model";
import Article from "../Article/Article";

type Props = {
    posts: TPost[];
};

const Blog: FC<Props> = ({ posts }) => {
    return (
        <Box as="section" width="extraLarge" margin="auto">
            <Box as="div" width="extraLarge"  margin="extraLarge"/>
            <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
                {posts.map((post) => (
                    <Article key={post.id} post={post} />
                ))}
            </Box>
        </Box>
    );
};

export default Blog;
