import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('posts');
  
  // 过滤掉草稿
  const publishedPosts = posts.filter(post => !post.data.draft);
  
  // 按发布日期排序
  publishedPosts.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  });

  const siteUrl = 'https://blog.frc.cc';
  
  // 收集所有分类和标签
  const categorySet = new Set();
  const tagSet = new Set();
  posts.forEach(post => {
    const categories = post.data.categories || [];
    const tags = post.data.tags || [];
    categories.forEach(cat => categorySet.add(cat));
    tags.forEach(tag => tagSet.add(tag));
  });
  
  // 生成 URL 列表
  const urls = [
    // 首页
    {
      loc: siteUrl,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 1.0,
    },
    // 归档页
    {
      loc: `${siteUrl}/archives`,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 0.8,
    },
    // 关于页
    {
      loc: `${siteUrl}/about`,
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: 0.5,
    },
    // 分类列表页
    {
      loc: `${siteUrl}/categories`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.7,
    },
    // 分类详情页
    ...Array.from(categorySet).map(category => ({
      loc: `${siteUrl}/categories/${encodeURIComponent(category)}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.6,
    })),
    // 标签列表页
    {
      loc: `${siteUrl}/tags`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.7,
    },
    // 标签详情页
    ...Array.from(tagSet).map(tag => ({
      loc: `${siteUrl}/tags/${encodeURIComponent(tag)}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.6,
    })),
    // 所有文章
    ...publishedPosts.map(post => ({
      loc: `${siteUrl}/post/${post.id.replace('.md', '')}`,
      lastmod: new Date(post.data.pubDate).toISOString(),
      changefreq: 'weekly',
      priority: 0.6,
    })),
  ];

  // 生成 XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
