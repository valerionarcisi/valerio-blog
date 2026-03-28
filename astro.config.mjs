// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  adapter: netlify(),
  vite: {
    define: {
      "import.meta.env.ADMIN_TOKEN": JSON.stringify(
        process.env.ADMIN_TOKEN ?? "",
      ),
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin/") && !page.includes("/tag/"),
    }),
  ],
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
