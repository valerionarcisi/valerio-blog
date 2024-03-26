import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Enable React to support React JSX components.
  integrations: [react(), sitemap()],
  prefetch: true,
  output: "server",
  adapter: netlify(),
  vite: {
    plugins: [vanillaExtractPlugin()]
  }
});