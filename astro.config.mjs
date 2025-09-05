// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  integrations: [sitemap()],
  server: {
    headers: {
      "Access-Control-Allow-Origin": "https://valerionarcisi.me",
    },
  },
});
