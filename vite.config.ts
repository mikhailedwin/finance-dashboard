import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `base` must match the GitHub Pages project path (https://<user>.github.io/<repo>/)
 * or every built asset resolves to the domain root and 404s. Override with
 * BASE_PATH=/ when deploying to a custom domain or a user/org Pages site.
 */
const base = process.env.BASE_PATH ?? '/finance-dashboard/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    // Recharts and React are large and change rarely; splitting them keeps the
    // app chunk small so data/UI edits do not bust the vendor cache.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Order matters: match the chart library before React, since its
          // transitive deps live under node_modules/react-* too.
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts';
          }
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
});
