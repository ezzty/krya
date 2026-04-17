// @ts-check
import { defineConfig } from 'astro/config';
import { rehypeImageProcessor } from './src/lib/rehype-image-processor';

export default defineConfig({
  site: 'https://frc.cc',
  output: 'static',
  compressHTML: true,
  markdown: {
    rehypePlugins: [rehypeImageProcessor],
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
