// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  integrations: [mdx(), sitemap()],
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
