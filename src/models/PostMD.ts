import { z } from "astro:content";


export const PostMDSchema = z.object({
    tags: z.array(z.string()),
    author: z.string(),
    cover: z.string(),
    coverAuthor: z.string().optional(),
    coverLinkSource: z.string().optional(),
    createdAt: z.string(),
    extract: z.string(),
    isDraft: z.enum(['No', 'Yes']),
    language: z.enum(['en', 'it']),
    title: z.string(),
})


export type TPostMD = z.infer<typeof PostMDSchema>