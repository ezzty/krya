// 构建后处理：仅为阿里云 OSS/CDN 图片追加 w950 参数
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const distDir = join(__dirname, '..', 'dist', 'post');

// 与 src/lib/utils.ts isOssCdnUrl 保持一致
function isOssCdnUrl(url) {
  if (!url || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return false;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'i.190808.xyz' ||
      host.endsWith('.aliyuncs.com')
    );
  } catch {
    return false;
  }
}

// 检查目录是否存在
if (!existsSync(distDir)) {
  console.log(`Skip: ${distDir} does not exist`);
  process.exit(0);
}

// 处理文章图片 URL - 仅 OSS 域名添加 w950 参数
function processArticleImageUrl(url) {
  if (!url) return url;

  // 跳过 data URI / 特殊协议 / 非 OSS
  if (url.startsWith('data:') || url.startsWith('blob:') || !isOssCdnUrl(url)) {
    return url;
  }

  // 移除已有的 OSS 参数
  const withoutOssParam = url.replace(/\?x-oss-process=[^&\s]*/, '');

  // 添加 w950 参数
  return `${withoutOssParam}?x-oss-process=style/w950`;
}

// 处理 srcset 中的多个 URL
function processSrcset(srcset) {
  if (!srcset) return srcset;
  return srcset.split(',').map((part) => {
    const trimmed = part.trim();
    // srcset 项可能是 "url 140w"
    const match = trimmed.match(/^(\S+)(\s+.+)?$/);
    if (!match) return trimmed;
    const newUrl = processArticleImageUrl(match[1]);
    return match[2] ? `${newUrl}${match[2]}` : newUrl;
  }).join(', ');
}

// 读取所有文章目录
const postDirs = readdirSync(distDir).filter(dir => {
  return !dir.startsWith('.');
});

console.log(`Processing ${postDirs.length} posts...`);

let totalImages = 0;
let skippedNonOss = 0;

postDirs.forEach(dir => {
  const htmlFile = join(distDir, dir, 'index.html');

  try {
    let content = readFileSync(htmlFile, 'utf-8');
    let modified = false;

    // 处理 img 标签的 src 属性
    content = content.replace(/src="([^"]+)"/g, (match, url) => {
      // 跳过 logo / js / data
      if (url.includes('logo.svg') || url.includes('/js/') || url.includes('data:')) {
        return match;
      }

      if (!isOssCdnUrl(url) && (url.startsWith('http://') || url.startsWith('https://'))) {
        skippedNonOss++;
      }

      const newUrl = processArticleImageUrl(url);
      if (newUrl !== url) {
        modified = true;
        totalImages++;
        return `src="${newUrl}"`;
      }
      return match;
    });

    // 处理 source 标签的 srcset 属性
    content = content.replace(/srcset="([^"]+)"/g, (match, srcset) => {
      const newSrcset = processSrcset(srcset);
      if (newSrcset !== srcset) {
        modified = true;
        return `srcset="${newSrcset}"`;
      }
      return match;
    });

    if (modified) {
      writeFileSync(htmlFile, content, 'utf-8');
      console.log(`✓ ${dir}/index.html`);
    }
  } catch (err) {
    console.error(`Error processing ${htmlFile}:`, err.message);
  }
});

console.log(`\n✅ Processed ${totalImages} OSS images in ${postDirs.length} posts (skipped non-OSS candidates: ${skippedNonOss}).`);
