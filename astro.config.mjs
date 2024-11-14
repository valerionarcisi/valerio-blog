// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  integrations: [mdx(), sitemap(), react()],
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
