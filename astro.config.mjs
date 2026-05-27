// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://krya.com',
  output: 'static',
  compressHTML: true,
  markdown: {
    shikiConfig: {
      theme: 'dark-plus',
    },
  },
  vite: {
    build: {
      // 合并所有 CSS 到一个文件
      cssCodeSplit: false,
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },
});
