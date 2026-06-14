import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Build the SPA into the repo-root dist/ that the server serves.
export default defineConfig({
  plugins: [vue()],
  build: { outDir: '../dist', emptyOutDir: true }
});
