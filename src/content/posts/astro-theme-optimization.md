---
title: Astro 博客主题优化日记
pubDate: 2026-04-14
author: Jin
draft: false
---

今天花了一天时间优化 Astro 博客主题，主要解决了移动端布局一致性的问题。记录一下整个过程，也给遇到类似问题的朋友一个参考。

## 问题背景

我的博客使用 Astro + Sintu 主题，部署在阿里云 ESA。今天发现从首页点进文章页时，**作者信息和正文会"跳动"**，位置不一致。

## 问题排查

### 第一步：检查 HTML 结构

对比首页（HomeLayout）和文章详情页（PostLayout）的代码，发现差异：

**首页：**
```astro
<h1 class="col-9 post-title">标题</h1>
<ul class="col-9 post-meta">作者信息</ul>
<div class="col-9 post-content">正文</div>
```

**文章页（修复前）：**
```astro
<h1 class="post-title">标题</h1>
<ul class="post-meta">作者信息</ul>
<div class="post-content">正文</div>
```

问题找到了！文章页缺少 `.col-9` 类。

### 第二步：检查 CSS

移动端 CSS 对 `.col-9` 有特殊处理：

```css
@media (max-width: 799px) {
  .col-9 {
    display: block;
    float: none;
    clear: both;
    width: 100%;
    margin-left: 0;  /* ← 关键！没有这个类，位置就会跳 */
  }
}
```

首页有 `.col-9` 所以 `margin-left: 0`，文章页没有这个类，导致位置不一致。

## 解决方案

### 修复 1：恢复 `.col-9` 类

修改 `PostLayout.astro`，给标题、作者信息、正文都添加 `.col-9` 类：

```astro
<h1 class="col-9 post-title">标题</h1>
<ul class="col-9 post-meta">作者信息</ul>
<div class="col-9 post-content">正文</div>
```

### 修复 2：调整正文间距

发现正文还是有轻微跳动，进一步检查发现 `.post-content` 默认有 `margin-top: 0.5em`，在移动端需要明确设为 0：

```css
@media (max-width: 799px) {
  .post-content {
    margin-top: 0;
  }
}
```

## 其他优化

今天还做了其他一些调整：

1. **Logo 更新** - 从 isming.me 主题改为"佛系日志"文字 SVG
2. **移动端导航** - Logo 紧贴左边框（padding-left: 0），暗黑模式按钮紧挨 Logo（gap: 4px）
3. **CSS 构建优化** - 将 CSS 从 `public/` 移到 `src/styles/`，使用 Vite 打包

## 代码推送

所有修改已推送到 GitHub：
- https://github.com/ezzty/astro-sintu-theme
- https://github.com/ezzty/frc

## 总结

这个问题看似简单，但涉及到：
- HTML 结构一致性
- CSS 类的作用域
- 移动端响应式布局

**关键点：** 确保不同页面的相同元素使用相同的 CSS 类，尤其是在响应式布局中。

---

以上就是今天的优化日记，希望对大家有所帮助。🧘‍♂️
