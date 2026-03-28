// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";

// Build-time diagnostic: check if ADMIN_TOKEN is available
const at = process.env.ADMIN_TOKEN;
console.log(`[BUILD-DIAG] ADMIN_TOKEN: ${at ? `set (${at.length} chars)` : "NOT SET"}`);

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  adapter: netlify(),
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
