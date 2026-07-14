# KRYA

Jin 的个人博客 [krya.com](https://krya.com)，基于 **Astro 6** 的静态站点。

## 特性

- Astro 6 静态导出 + Content Collections
- 暗黑模式 / 响应式单栏布局
- Pagefind 全文搜索
- RSS（`/rss.xml`、`/feed/`）与自定义 sitemap
- Twikoo 评论、Umami 统计
- 阿里云 OSS 图片处理（仅 `i.190808.xyz` 等白名单域名）

## 快速开始

```bash
npm install
npm run dev      # 开发
npm run build    # 生产构建（含图片处理 + Pagefind）
npm run preview  # 预览 dist
```

## 项目结构

```
src/
  content/posts/     # Markdown 文章
  content.config.ts  # Collection schema
  components/        # NavBar、Twikoo
  layouts/           # Base / Home / Post
  lib/utils.ts       # 日期、摘要、缩略图、分页
  pages/             # 路由（首页、归档、分类、标签、搜索、RSS…）
  styles/            # grid.css + style.css（CSS 变量主题）
scripts/
  post-build-image-processor.js  # 文章页 OSS 图追加 w950
public/              # favicon、og-image、随机缩略图等
```

## 配置

| 项 | 位置 |
|----|------|
| 站点域名 | `astro.config.mjs` → `site` |
| 主题色 / 暗黑变量 | `src/styles/style.css` → `:root` / `[data-theme="dark"]` |
| 导航 | `src/components/NavBar.astro` |
| 评论 env | `src/components/Twikoo.astro`（默认 `https://cm.krya.com/`） |
| 关于页 | `src/pages/about.astro` |

文章 frontmatter 示例：

```yaml
---
title: 标题
pubDate: 2026-04-18
description: 可选摘要
categories: [旅游]
tags: [丽江]
draft: false
---
```

`pubDate` 支持纯日期或带时间；前端按东八区显示，纯日期只显示日期。

## 部署

推送到 GitHub `main` 后由 **Cloudflare Pages** 自动构建（`wrangler.toml` / 控制台配置 `npm run build` → `dist`）。

英文站： [en.krya.com](https://en.krya.com/)

## 技术栈

- [Astro](https://astro.build/) 6.x
- [Pagefind](https://pagefind.app/)
- [@astrojs/rss](https://docs.astro.build/en/guides/rss/)
- CSS Variables（无单独 `variables.css`）

## 许可证

MIT · Jin (@ezzty)
