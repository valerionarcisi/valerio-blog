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
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/marked')) return 'vendor-markdown';
            if (id.includes('node_modules/highlight')) return 'vendor-highlight';
            if (id.includes('node_modules')) return 'vendor';
            if (id.includes('/components/')) return 'components';
          }
        }
      }
    }
  }
});
