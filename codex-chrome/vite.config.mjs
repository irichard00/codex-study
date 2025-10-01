import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content-script.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        welcome: resolve(__dirname, 'src/welcome/welcome.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,  // Always enable source maps for debugging
    minify: true  // Always minify for consistency
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});