// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://krya.com',
  output: 'static',
  // 输出为目录 index.html，规范 URL 带尾斜杠；站内链接也应带 /
  trailingSlash: 'always',
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
