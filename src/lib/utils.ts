// 从 Markdown 内容中提取第一张图片
export function extractFirstImage(content: string): string | null {
  // 方法 1: 匹配带 title 的 Markdown 图片：![alt](url "title")
  const mdImgWithTitlePattern = /!\[([^\]]*)\]\(([^"]+?)\s+"[^"]*"\)/;
  let match = content.match(mdImgWithTitlePattern);
  if (match && match[2]) {
    return match[2].trim();
  }
  
  // 方法 2: 匹配不带 title 的 Markdown 图片：![alt](url)
  const mdImgSimplePattern = /!\[([^\]]*)\]\(([^)\s]+)\)/;
  match = content.match(mdImgSimplePattern);
  if (match && match[2]) {
    return match[2].trim();
  }
  
  // 方法 3: 匹配 HTML 图片标签：<img src="url">
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = content.match(htmlImgRegex);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1];
  }
  
  return null;
}

// 生成随机缩略图索引 (0-5)
export function getRandomThumbnailIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 6;
}

// 清理 Markdown 语法，返回纯文本
export function stripMarkdown(content: string): string {
  let text = content;
  
  // 移除图片：![alt](url "title") - 使用非贪婪匹配，只匹配到第一个 "
  text = text.replace(/!\[([^\]]*)\]\([^"\n]+?"[^"]*"\)/g, '');
  
  // 移除图片：![alt](url) - URL 不包含括号、空格或引号
  text = text.replace(/!\[([^\]]*)\]\(([^)\s\n]+)\)/g, '');
  
  // 移除链接：[text](url)
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  
  // 移除标题：# 标题
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // 移除粗体和斜体
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  
  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // 移除引用
  text = text.replace(/^>\s+/gm, '');
  
  // 移除列表
  text = text.replace(/^[\-\*]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  
  // 移除水平线
  text = text.replace(/^[-*_]{3,}$/gm, '');
  
  // 移除 HTML 标签
  text = text.replace(/<[^>]+>/g, '');
  
  // 清理多余空行
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.trim();
  
  return text;
}

// 计算中文字数
export function countWords(content: string): number {
  const plainText = stripMarkdown(content);
  
  // 匹配中文字符
  const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g);
  const chineseCount = chineseChars ? chineseChars.length : 0;
  
  // 匹配英文单词
  const englishWords = plainText.match(/[a-zA-Z0-9]+/g);
  const englishCount = englishWords ? englishWords.length : 0;
  
  return chineseCount + englishCount;
}
