import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    extract: z.string(),
    tags: z.array(z.string()),
    coverImage: z.string(),
    coverAuthorName: z.string().nullable().optional(),
    coverAuthorLink: z.string().nullable().optional(),
    coverDescription: z.string().nullable().optional(),
  }),
});

const films = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/films" }),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    role: z.string(),
    status: z.enum(["completed", "in-production", "post-production"]),
    sortOrder: z.number(),
    coverImage: z.string(),
    trailerLocalPath: z.string().optional(),
    trailerUrl: z.string().optional(),
    youtubeUrl: z.string().optional(),
    plot: z.string(),
    technicalSpecs: z
      .object({
        shootingFormat: z.string().optional(),
        soundFormat: z.string().optional(),
        aspectRatio: z.string().optional(),
        musicalRights: z.string().optional(),
        spokenLanguage: z.string().optional(),
        subtitleLanguages: z.array(z.string()).optional(),
        duration: z.string().optional(),
      })
      .optional(),
    crew: z
      .array(
        z.object({
          role: z.string(),
          name: z.string(),
          url: z.string().optional(),
        }),
      )
      .default([]),
    cast: z
      .array(
        z.object({
          name: z.string(),
          character: z.string().optional(),
          url: z.string().optional(),
        }),
      )
      .default([]),
    distribution: z
      .object({
        name: z.string(),
        url: z.string().optional(),
      })
      .optional(),
    festivals: z
      .array(
        z.object({
          name: z.string(),
          year: z.number(),
          location: z.string().optional(),
          award: z.string().optional(),
        }),
      )
      .default([]),
    specialThanks: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().optional(),
        }),
      )
      .default([]),
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

export const collections = { blog, films };
