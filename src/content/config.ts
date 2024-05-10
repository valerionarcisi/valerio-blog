import { defineCollection } from "astro:content";
import { PostMDSchema } from "../models";

const postsCollection = defineCollection({
    type: 'content',
    schema: PostMDSchema, 
});

export const collections = { posts: postsCollection }