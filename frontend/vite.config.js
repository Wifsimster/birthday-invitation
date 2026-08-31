import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

// Stamp the app version (from package.json) and the build timestamp into the
// bundle so the running build is identifiable at runtime (see BuildFooter).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Build the SPA into the repo-root dist/ that the server serves.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // "@" is the import root shadcn-vue components expect (@/lib/utils,
    // @/components/ui/...), so generated components drop in unmodified.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  build: { outDir: '../dist', emptyOutDir: true }
});
