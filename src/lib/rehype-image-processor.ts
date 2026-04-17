// rehype 插件：自动为文章内的图片添加阿里云 OSS w950 参数
import type { Root } from 'hast';

export function rehypeImageProcessor() {
  return (tree: Root) => {
    // 遍历所有元素节点
    const visit = (node: any, callback: (node: any) => void) => {
      if (node.type === 'element') {
        callback(node);
        if (node.children) {
          node.children.forEach((child: any) => visit(child, callback));
        }
      }
    };

    visit(tree, (node) => {
      // 处理 <img> 标签
      if (node.tagName === 'img' && node.properties?.src) {
        node.properties.src = processArticleImageUrl(node.properties.src);
      }
      // 处理 <source> 标签（<picture> 元素内）
      if (node.tagName === 'source' && node.properties?.srcset) {
        node.properties.srcset = processArticleImageUrl(node.properties.srcset);
      }
    });
  };
}

// 处理文章图片 URL - 添加 w950 参数
export function processArticleImageUrl(url: string): string {
  if (!url) return url;
  
  // 如果是多个 URL（srcset），分别处理
  if (url.includes(',')) {
    return url.split(',').map(u => processSingleUrl(u.trim())).join(', ');
  }
  
  return processSingleUrl(url);
}

function processSingleUrl(url: string): string {
  // 跳过已经是 data URI 或特殊协议的图片
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // 移除已有的 OSS 参数（如果有）
  const withoutOssParam = url.replace(/\?x-oss-process=[^&\s]*/, '');
  
  // 添加 w950 参数
  return `${withoutOssParam}?x-oss-process=style/w950`;
}
