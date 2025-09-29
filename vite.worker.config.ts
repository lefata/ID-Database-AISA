import { defineConfig } from 'vite';

// This is the separate config for building the worker.
export default defineConfig({
  build: {
    rollupOptions: {
      input: 'worker/index.ts',
      output: {
        entryFileNames: '_worker.js', // Cloudflare Pages recognizes this file
        format: 'es',
      },
    },
    minify: true,
    outDir: 'dist',
    emptyOutDir: false, // Important: don't wipe out the frontend build
    target: 'esnext',
  },
});
