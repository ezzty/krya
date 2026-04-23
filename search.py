#!/usr/bin/env python3
"""
Krya 博客搜索索引生成器
直接生成 JSON 索引文件，无需数据库依赖
"""

import json
import os
import re
from pathlib import Path
from collections import Counter
import math

# 配置
CONTENT_DIR = Path(__file__).parent / "src" / "content" / "posts"
OUTPUT_FILE = Path(__file__).parent / "public" / "search-index.json"

def extract_frontmatter(content: str) -> dict:
    """提取 Markdown frontmatter"""
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if not match:
        return {}
    
    frontmatter = {}
    for line in match.group(1).strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip().strip('"\'')
    return frontmatter

def tokenize(text: str) -> list:
    """中文分词（简单版：按字符和常用词）"""
    # 移除 HTML 标签
    text = re.sub(r'<[^>]+>', '', text)
    # 移除特殊字符
    text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
    # 分词（简单：按空格和中文单字）
    words = []
    for word in text.split():
        if len(word) > 0:
            words.append(word.lower())
    return words

def calculate_bm25(documents: list, k1: float = 1.5, b: float = 0.75) -> dict:
    """
    计算 BM25 索引
    返回：{term: {doc_id: score}}
    """
    # 文档长度
    doc_lengths = [len(doc['tokens']) for doc in documents]
    avg_doc_length = sum(doc_lengths) / len(documents) if documents else 0
    
    # 词频统计
    doc_freq = Counter()  # 包含该词的文档数
    term_freq = [Counter(doc['tokens']) for doc in documents]  # 每个文档的词频
    
    for tf in term_freq:
        for term in tf:
            doc_freq[term] += 1
    
    # 计算 IDF
    n_docs = len(documents)
    idf = {}
    for term, df in doc_freq.items():
        idf[term] = math.log((n_docs - df + 0.5) / (df + 0.5) + 1)
    
    # 构建索引
    index = {}
    for doc_id, tf in enumerate(term_freq):
        for term, freq in tf.items():
            if term not in index:
                index[term] = {}
            
            # BM25 分数
            score = (idf[term] * freq * (k1 + 1)) / (freq + k1 * (1 - b + b * doc_lengths[doc_id] / avg_doc_length))
            index[term][doc_id] = round(score, 4)
    
    return index

def main():
    print("🔍 Krya 博客搜索索引生成器")
    print("=" * 40)
    
    # 收集所有文章
    articles = []
    for md_file in sorted(CONTENT_DIR.glob("*.md")):
        content = md_file.read_text(encoding='utf-8')
        frontmatter = extract_frontmatter(content)
        
        if frontmatter.get('draft') == 'true':
            continue
        
        # 提取正文（移除 frontmatter）
        body = re.sub(r'^---\s*\n.*?\n---\s*\n', '', content, flags=re.DOTALL)
        tokens = tokenize(body)
        
        articles.append({
            'id': md_file.stem,
            'title': frontmatter.get('title', md_file.stem),
            'date': frontmatter.get('date', ''),
            'categories': frontmatter.get('categories', '').split(','),
            'tags': frontmatter.get('tags', '').split(','),
            'tokens': tokens,
        })
        
        print(f"  ✓ {frontmatter.get('title', md_file.stem)[:30]}")
    
    print(f"\n📊 共 {len(articles)} 篇文章")
    
    # 计算 BM25 索引
    print("\n⚙️  计算 BM25 索引...")
    bm25_index = calculate_bm25(articles)
    
    # 构建输出格式
    output = {
        'articles': [
            {
                'id': art['id'],
                'title': art['title'],
                'date': art['date'],
                'categories': [c.strip() for c in art['categories'] if c.strip()],
                'tags': [t.strip() for t in art['tags'] if t.strip()],
            }
            for art in articles
        ],
        'index': bm25_index,
    }
    
    # 保存 JSON
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 索引已保存到：{OUTPUT_FILE}")
    print(f"📦 文件大小：{OUTPUT_FILE.stat().st_size / 1024:.1f} KB")
    print(f"📈 索引词数：{len(bm25_index)}")

if __name__ == "__main__":
    main()
