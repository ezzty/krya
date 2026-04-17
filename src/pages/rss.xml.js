import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  
  // 按日期排序，只输出最近 20 篇
  const sortedPosts = posts.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  }).slice(0, 20);
  
  return rss({
    title: '浮生百记 | Jin 的个人博客',
    description: 'Jin 的个人博客 - 旅行、生活、感悟',
    site: context.site,
    items: await Promise.all(sortedPosts.map(async (post) => {
      // 直接使用 post.content 获取 Markdown 内容
      const markdownContent = post.body || '';
      
      // 简单转换为 HTML（保留基本标签）
      const htmlString = markdownContent
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/\n/gim, '<br />');
      
      // 全文输出
      const description = htmlString;
      
      return {
        title: post.data.title,
        description: description,
        pubDate: post.data.pubDate,
        link: `/post/${post.id.replace('.md', '')}`,
        author: post.data.author || 'Jin',
      };
    })),
    customData: `<language>zh-cn</language>`,
  });
}
