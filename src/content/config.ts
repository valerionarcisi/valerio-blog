import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    tags: z.array(z.string()),
    author: z.string(),
    cover: z.string(),
    coverAuthor: z.string().optional(),
    coverLinkSource: z.string().optional(),
    createdAt: z.coerce.date(),
    description: z.string(),
    isDraft: z.enum(['No', 'Yes']),
    language: z.enum(['en', 'it']),
    title: z.string(),
  }),
});

export const collections = { blog };
