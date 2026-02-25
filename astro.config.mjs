// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  adapter: netlify(),
  integrations: [sitemap()],
  i18n: {
    locales: ["it", "en"],
    defaultLocale: "it",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    shikiConfig: {
      theme: "tokyo-night",
    },
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "https://valerionarcisi.me",
    },
  },
});
