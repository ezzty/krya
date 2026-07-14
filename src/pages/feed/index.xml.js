import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

// 处理日期：将 pubDate 转为北京时间 (+08:00)，精确到分钟
function normalizePubDate(date) {
  if (!date) return date;
  
  // 如果是 Date 对象
  if (date instanceof Date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    
    // 如果是 UTC 00:00（原日期只有日期无时间），默认北京时间 09:00
    if (hours === 0 && minutes === 0) {
      return new Date(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T09:00:00+08:00`);
    }
    
    // 已有时间，转为 +08:00 格式
    const utcTime = date.getTime();
    const beijingTime = new Date(utcTime + 8 * 3600 * 1000);
    const by = beijingTime.getUTCFullYear();
    const bm = beijingTime.getUTCMonth();
    const bd = beijingTime.getUTCDate();
    const bh = beijingTime.getUTCHours();
    const bmin = beijingTime.getUTCMinutes();
    return new Date(`${by}-${String(bm+1).padStart(2,'0')}-${String(bd).padStart(2,'0')}T${String(bh).padStart(2,'0')}:${String(bmin).padStart(2,'0')}:00+08:00`);
  }
  
  // 如果是字符串
  if (typeof date === 'string') {
    // YYYY-MM-DD 格式 → 北京时间 09:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Date(`${date}T09:00:00+08:00`);
    }
    // 已有时间但无时区 → 默认为北京时间
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) && !date.includes('+')) {
      return new Date(`${date}+08:00`);
    }
    return new Date(date);
  }
  
  return date;
}

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
        pubDate: normalizePubDate(post.data.pubDate),
        link: `/post/${post.id.replace('.md', '')}/`,
        author: post.data.author || 'Jin',
      };
    })),
    customData: `<language>zh-cn</language>`,
  });
}
