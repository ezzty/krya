import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

export async function GET(context) {
  const posts = (await getCollection('posts')).filter(post => !post.data.draft);
  
  // 按日期排序，只输出最近 20 篇
  const sortedPosts = posts.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  }).slice(0, 20);
  
  return rss({
    title: 'krya | jin 的个人博客',
    description: 'Jin 的个人博客 - 旅行、生活、感悟',
    site: 'https://krya.com',
    items: await Promise.all(sortedPosts.map(async (post) => {
      const markdownContent = post.body || '';
      const htmlString = await marked.parse(markdownContent);
      
      return {
        title: post.data.title,
        description: htmlString,
        pubDate: post.data.pubDate,
        link: `/post/${post.id.replace('.md', '')}`,
        author: post.data.author || 'Jin',
      };
    })),
    customData: `<language>zh-cn</language>`,
  });
}
