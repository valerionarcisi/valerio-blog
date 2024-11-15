import { z as zod } from "astro:content";
import fetchHyGraph from "./fetchHyGraph";

const PostScheme = zod.object({
  title: zod.string(),
  date: zod.string(),
  createdAt: zod.string(),
  extract: zod.string(),
  slug: zod.string(),
  content: zod.string(),
  lang: zod.string(),
  tags: zod.array(zod.string()),
  coverImage: zod.object({
    url: zod.string()
  }),
  coverAuthorName: zod.string().optional(),
  coverAuthorLink: zod.string().optional()
});

const AbstractPostScheme = PostScheme.omit({ content: true, lang: true });
const AbstractPostCollectionScheme = zod.array(AbstractPostScheme);

export type TPost = zod.infer<typeof PostScheme>;
export type TAbstractPost = zod.infer<typeof AbstractPostScheme>;
export type TAbstractPostCollectionScheme = zod.infer<
  typeof AbstractPostCollectionScheme
>;

const fetchHyPosts = async (limit = 5) => {
  const GET_POSTS = `{ 
    posts (orderBy: date_DESC first: ${limit}) {
      title
      date
      createdAt
      extract
      slug,
      tags,
      lang,
      content,
      coverImage {
    	  id,
        url,
    	}
    }
  }
`;

  try {
    const { posts } = await fetchHyGraph<{
      posts: TPost[];
    }>(GET_POSTS);
    AbstractPostCollectionScheme.parse(posts);
    return posts;
  } catch (error) {
    console.error(error);
  }
};

export default fetchHyPosts;
