import { defineConfig } from "astro/config";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@astrojs/react";

import netlify from "@astrojs/netlify/functions";

// https://astro.build/config
export default defineConfig({
  // Enable React to support React JSX components.
  integrations: [react()],
  prefetch: true,
  output: "server",
  adapter: netlify(),
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
});
