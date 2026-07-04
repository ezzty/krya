// 从 Markdown 内容中提取第一张图片
export function extractFirstImage(content: string): string | null {
  const mdImgWithTitlePattern = /!\[([^\]]*)\]\(([^"]+?)\s+"[^"]*"\)/;
  let match = content.match(mdImgWithTitlePattern);
  if (match && match[2]) {
    return match[2].trim();
  }
  
  const mdImgSimplePattern = /!\[([^\]]*)\]\(([^)\s]+)\)/;
  match = content.match(mdImgSimplePattern);
  if (match && match[2]) {
    return match[2].trim();
  }
  
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = content.match(htmlImgRegex);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }
  
  return null;
}

// 格式化日期：2026-04-18（只显示日期，使用东八区）
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // 使用东八区 (UTC+8) 避免跨天问题
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() + offset + 8 * 3600000);
  return local.toISOString().split('T')[0];
}

// 截取摘要（减少 4 个字符）
export function truncateExcerpt(excerpt: string, length: number = 67): string {
  if (!excerpt) return '';
  return excerpt.slice(0, length);
}

// 生成页码列表（最多显示 5 个页码，移动端 CSS 隐藏为 3 个）
export function getPageNumbers(current: number, total: number): number[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  
  if (current <= 3) {
    return [1, 2, 3, 4, 5];
  }
  
  if (current >= total - 2) {
    return [total - 4, total - 3, total - 2, total - 1, total];
  }
  
  return [current - 2, current - 1, current, current + 1, current + 2];
}

// 处理缩略图 URL
export function processThumbnailUrl(url: string | null, thumbnailStyle: string = 'w140'): string | null {
  if (!url) return null;
  const withoutOssParam = url.replace(/\?x-oss-process=[^&\s]*/, '');
  return `${withoutOssParam}?x-oss-process=style/${thumbnailStyle}`;
}

// 生成随机缩略图索引
export function getRandomThumbnailIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
  }
  return Math.abs(hash) % 6;
}

// 清理 Markdown
export function stripMarkdown(content: string): string {
  let text = content;
  text = text.replace(/!\[([^\]]*)\]\([^"\n]+?"[^"]*"\)/g, '');
  text = text.replace(/!\[([^\]]*)\]\(([^)\s\n]+)\)/g, '');
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^>\s+/gm, '');
  text = text.replace(/^[-*]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  text = text.replace(/^[-*_]{3,}$/gm, '');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

// 计算字数
export function countWords(content: string): number {
  const plainText = stripMarkdown(content);
  const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  const englishWords = plainText.match(/[a-zA-Z0-9]+/g);
  const englishCount = englishWords ? englishWords.length : 0;
  return chineseCount + englishCount;
}

// 格式化文章列表
export interface PostData {
  title: string;
  pubDate: Date;
  author?: string;
  description?: string;
  thumbnail?: string;
  draft?: boolean;
}


// 获取文章集合的分类计数（去重，按数量降序）
export function buildCategoryCounts(posts: PostEntry[]) {
  const count = new Map<string, number>();
  posts.forEach(post => {
    const categories = post.data.categories || [];
    categories.forEach(cat => {
      count.set(cat, (count.get(cat) || 0) + 1);
    });
  });
  return Array.from(count.entries()).sort((a, b) => b[1] - a[1]);
}

export interface PostEntry {
  id: string;
  data: PostData;
  body?: string;
}

export interface FormattedPost {
  title: string;
  slug: string;
  author: string;
  pubDate: string;
  wordCount: number;
  excerpt: string;
  thumbnail: string;
}

export interface FormatPostsResult {
  posts: FormattedPost[];
  totalPages: number;
  currentPage: number;
}

export function formatPosts(posts: PostEntry[], pageSize: number, page: number = 1): FormatPostsResult {
  const sortedPosts = posts.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  });
  
  const totalPages = Math.ceil(sortedPosts.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = page * pageSize;
  const paginatedPosts = sortedPosts.slice(start, end);
  
  const formattedPosts = paginatedPosts.map((post) => {
    let thumbnail = post.data.thumbnail;
    if (!thumbnail) {
      const firstImage = extractFirstImage(post.body || '');
      if (firstImage) {
        thumbnail = firstImage;
      } else {
        thumbnail = `/img/random/${getRandomThumbnailIndex(post.id)}.webp`;
      }
    }
    
    thumbnail = processThumbnailUrl(thumbnail, 'w140');
    const plainText = stripMarkdown(post.body || '');
    const wordCount = countWords(post.body || '');
    
    return {
      title: post.data.title,
      slug: post.id.replace(/\.[^.]+$/, ''),
      author: post.data.author || 'Jin',
      pubDate: (() => {
        const d = new Date(post.data.pubDate);
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() + offset + 8 * 3600000);
        return local.toISOString();
      })(),
      wordCount,
      excerpt: post.data.description || plainText.slice(0, 67),
      thumbnail,
    };
  });
  
  return {
    posts: formattedPosts,
    totalPages,
    currentPage: page,
  };
}
