// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://krya.com',
  output: 'static',
  compressHTML: true,
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },
});
