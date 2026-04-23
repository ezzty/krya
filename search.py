#!/usr/bin/env python3
"""
Krya 博客语义搜索
使用 BM25 算法进行文章搜索
"""

import os
import json
import sqlite3
import re
from pathlib import Path
from collections import Counter
import math

# 配置
KRYA_POSTS_DIR = "/home/jin/work/krya/src/content/posts"
DB_PATH = "/home/jin/work/krya/search_index.db"

class BM25Search:
    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1  # 词频饱和度参数
        self.b = b    # 文档长度归一化参数
        self.documents = {}  # id -> content
        self.doc_lengths = {}  # id -> length
        self.avg_doc_length = 0
        self.vocab = set()
        self.idf = {}  # 逆文档频率
        
    def tokenize(self, text):
        """简单的中文分词（按字符 n-gram + 英文单词）"""
        # 提取英文单词
        words = re.findall(r'[a-zA-Z]+', text.lower())
        # 提取中文字符（2-gram）
        chinese = re.findall(r'[\u4e00-\u9fff]{2,3}', text)
        return words + chinese
    
    def index(self, doc_id, text):
        """索引文档"""
        tokens = self.tokenize(text)
        self.documents[doc_id] = Counter(tokens)
        self.doc_lengths[doc_id] = len(tokens)
        self.vocab.update(tokens)
    
    def build_index(self):
        """构建 IDF 索引"""
        n_docs = len(self.documents)
        self.avg_doc_length = sum(self.doc_lengths.values()) / n_docs if n_docs > 0 else 0
        
        # 计算每个词的文档频率
        doc_freq = Counter()
        for tokens in self.documents.values():
            doc_freq.update(set(tokens.keys()))
        
        # 计算 IDF
        for term, freq in doc_freq.items():
            self.idf[term] = math.log((n_docs - freq + 0.5) / (freq + 0.5) + 1)
    
    def search(self, query, top_k=10):
        """搜索"""
        query_tokens = self.tokenize(query)
        scores = {}
        
        for doc_id, doc_tokens in self.documents.items():
            score = 0
            doc_len = self.doc_lengths[doc_id]
            
            for term in query_tokens:
                if term not in doc_tokens:
                    continue
                
                # BM25 公式
                tf = doc_tokens[term]
                idf = self.idf.get(term, 0)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_doc_length)
                score += idf * numerator / denominator
            
            if score > 0:
                scores[doc_id] = score
        
        # 排序
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_docs[:top_k]


def read_post(path):
    """读取文章"""
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    title = ""
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2]
            for line in frontmatter.split('\n'):
                if line.startswith("title:"):
                    title = line.split(":", 1)[1].strip().strip('"\'')
    
    return {
        "title": title or path.stem,
        "body": body,
        "full_text": f"{title} {body}"
    }


def build_index():
    """构建搜索索引"""
    print("开始构建搜索索引...")
    
    search = BM25Search()
    posts_dir = Path(KRYA_POSTS_DIR)
    md_files = sorted(posts_dir.glob("*.md"))
    
    print(f"找到 {len(md_files)} 篇文章")
    
    for md_file in md_files:
        post = read_post(md_file)
        search.index(md_file.stem, post['full_text'])
        print(f"  ✓ {md_file.name}")
    
    search.build_index()
    
    # 保存到 SQLite
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('DROP TABLE IF EXISTS posts')
    c.execute('''
        CREATE TABLE posts (
            id TEXT PRIMARY KEY,
            title TEXT,
            body TEXT
        )
    ''')
    
    c.execute('DROP TABLE IF EXISTS index_data')
    c.execute('''
        CREATE TABLE index_data (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # 保存文章
    for md_file in md_files:
        post = read_post(md_file)
        c.execute('INSERT INTO posts VALUES (?, ?, ?)', 
                  (md_file.stem, post['title'], post['body']))
    
    # 保存索引数据
    index_data = {
        'documents': {k: dict(v) for k, v in search.documents.items()},
        'doc_lengths': search.doc_lengths,
        'avg_doc_length': search.avg_doc_length,
        'idf': search.idf
    }
    c.execute('INSERT INTO index_data VALUES (?, ?)', 
              ('bm25_index', json.dumps(index_data)))
    
    conn.commit()
    conn.close()
    
    print(f"\n索引完成！共 {len(md_files)} 篇文章")
    print(f"数据库：{DB_PATH}")
    return search


def load_search():
    """加载索引"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('SELECT value FROM index_data WHERE key=?', ('bm25_index',))
    row = c.fetchone()
    conn.close()
    
    if not row:
        return None
    
    data = json.loads(row[0])
    
    search = BM25Search()
    search.documents = {k: Counter(v) for k, v in data['documents'].items()}
    search.doc_lengths = data['doc_lengths']
    search.avg_doc_length = data['avg_doc_length']
    search.idf = data['idf']
    search.vocab = set()
    for tokens in search.documents.values():
        search.vocab.update(tokens.keys())
    
    return search


def search_query(query, top_k=5):
    """搜索文章"""
    search = load_search()
    if not search:
        print("索引不存在，请先运行 build_index()")
        return
    
    results = search.search(query, top_k)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    print(f"\n🔍 搜索：{query}")
    print(f"找到 {len(results)} 篇相关文章\n")
    
    for i, (doc_id, score) in enumerate(results, 1):
        c.execute('SELECT title FROM posts WHERE id=?', (doc_id,))
        row = c.fetchone()
        title = row[0] if row else doc_id
        print(f"{i}. [{score:.3f}] {title}")
        print(f"   文件：{doc_id}.md")
    
    conn.close()
    return results


def export_json():
    """导出索引为 JSON 供前端使用"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 获取所有文章
    c.execute('SELECT id, title FROM posts ORDER BY title')
    posts = [{'id': row[0], 'title': row[1]} for row in c.fetchall()]
    
    # 获取索引数据
    c.execute('SELECT value FROM index_data WHERE key=?', ('bm25_index',))
    row = c.fetchone()
    conn.close()
    
    if not row:
        print("索引不存在")
        return
    
    data = json.loads(row[0])
    
    # 导出为前端可用格式
    export_data = {
        'posts': posts,
        'index': {
            'documents': {k: dict(v) for k, v in data['documents'].items()},
            'doc_lengths': data['doc_lengths'],
            'avg_doc_length': data['avg_doc_length'],
            'idf': data['idf']
        }
    }
    
    output_path = Path(KRYA_POSTS_DIR).parent.parent / 'public' / 'search-index.json'
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    print(f"索引已导出：{output_path}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--export':
            export_json()
        else:
            # 搜索模式
            query = " ".join(sys.argv[1:])
            search_query(query)
    else:
        # 构建索引并导出
        build_index()
        export_json()
