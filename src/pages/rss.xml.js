import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  
  // 按日期排序
  const sortedPosts = posts.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  });
  
  return rss({
    title: 'KRYA | Jin 的个人博客',
    description: 'Jin 的个人博客 - 技术、生活、旅行',
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
      
      // 提取纯文本内容（去除 HTML 标签）
      const textContent = htmlString.replace(/<[^>]+>/g, '');
      
      // 截取最多 300 字，不足 300 字则全文
      const description = textContent.length <= 300 
        ? textContent 
        : textContent.substring(0, 300) + '...';
      
      return {
        title: post.data.title,
        description: description,
        pubDate: post.data.pubDate,
        link: `/blog/${post.id.replace('.md', '')}/`,
        author: post.data.author || 'Jin',
      };
    })),
    customData: `<language>zh-cn</language>`,
  });
}
