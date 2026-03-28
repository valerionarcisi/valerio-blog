// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";

const envKeys = [
  "ADMIN_TOKEN",
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "STRAVA_CLIENT_ID",
  "STRAVA_CLIENT_SECRET",
  "STRAVA_REFRESH_TOKEN",
  "TMDB_API_KEY",
  "LASTFM_API_KEY",
  "RESEND_API_KEY",
];
/** @type {Record<string, string>} */
const define = {};
for (const key of envKeys) {
  if (process.env[key]) {
    define[`import.meta.env.${key}`] = JSON.stringify(process.env[key]);
  }
}

// https://astro.build/config
export default defineConfig({
  site: "https://valerionarcisi.me",
  adapter: netlify(),
  vite: { define },
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
