---
title: 低成本自建阿里云函数计算FC+OSS图床
description: 每一个静态博客都必备第三方图床；但是哪个图床不跑路呢？很难说。而且你用别人的图床：防盗链规则不受你控制、服务跑路图片全 404、内容审核误伤、免费额度藏陷阱。踩了很多坑之后，决定自己给自己搞一个极低使用成本的图床。主要目的就是省钱，不限量！
pubDate: 2026-10-14
heroImage: ""
categories:
  - 科技
tags:
  - oss自建图床
  - 阿里云函数oss图床
  - 云函数fc图床
author: jin
---
![image](https://i.190808.xyz/m/26j13/0f38e9.png)

> 源码：https://github.com/ezzty/oss-upload

**先说三件事：**

1. 本文所有 `AccessKey`、密码、域名、Bucket 名**都是占位符**，照抄前请替换成你自己的。
2. 代码是单文件 Node.js（约 380 行），依赖通过 FC **层（Layer）** 注入，业务代码零硬编码，全部配置走环境变量。
3. 走完这篇，你会得到：`登录 → 拿 token → 上传 → 返回 Markdown 图片语法` 的完整链路，且上线前有可执行的验收清单。

---

### 一、为什么自建图床

每一个静态博客都必备第三方图床；但是哪个图床不跑路呢？很难说。而且你用别人的图床：防盗链规则不受你控制、服务跑路图片全 404、内容审核误伤、免费额度藏陷阱。

踩了很多坑之后，决定自己给自己搞一个极低使用成本的图床。主要目的就是省钱，不限量！

- **数据在自己账号里**，随时能导出、能迁移
- **计费按量**，个人图床的用量基本落在免费额度边缘
- **安全策略自己定**：谁能传、传多大、放哪个目录、给谁看，全部可控

代价是你要自己处理鉴权、防爆破、类型校验这些脏活——本文已经替你处理完了。

---

### 二、架构与请求流程

```typescript
浏览器 upload.html
   │  ① POST /login   {user, pass}
   │  ← 200 {token}（有效期 24h）
   │  ② POST /upload  Authorization: Bearer <token> + 图片二进制
   ▼
阿里云函数计算 FC（Node.js 18，HTTP 触发器）
   │  鉴权 / 限流 / 魔数校验 / 体积校验
   │  ③ ossClient.put(key, stream)
   ▼
OSS Bucket（私有读写，禁止公共读）
   │  ④ CDN 回源（内网，免费）
   ▼
https://img.example.com/m/26j13/ab12cd.jpg   ← 对外访问域名
```

**三个设计取舍：**

- **Bucket 设为私有**：不给任何人直链读权限，图片只能通过绑定了 CDN 域名的 URL 访问。一旦公开读，你的桶就变成了公共资源，别人能列举、能白嫖流量。
- **必须登录才能上传**：否则你的 API 域名会被人当免费图床刷，成本和存储直接失控。
- **业务代码不碰密钥**：AK/SK 只存在于环境变量里，代码和仓库里永远看不到。

---

### 三、准备工作

#### 3.1 开通产品

开通 **函数计算 FC** 和 **对象存储 OSS**（都按量付费，不预购）。

#### 3.2 创建 Bucket

- **名称**：全局唯一，例如 `my-img`
- **地域**：选离你/你的用户近的，例如 `华东1（杭州）` → `oss-cn-hangzhou`
- **读写权限**：**私有**（重要）
- **存储类型**：标准存储（高频访问的图片就该用这个，别选低频/归档——那些有最短存储时长，删早了反而扣钱）

#### 3.3 创建 RAM 用户并限权到单桶（**强烈建议**）

很多教程直接让你用主账号 AccessKey——**不要这么做**。主账号 AK 泄露等于整个阿里云账号沦陷。

RAM 控制台 → 权限策略 → 创建权限策略 → **JSON** 标签：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:GetObject",
        "oss:PutObject",
        "oss:DeleteObject",
        "oss:ListObjects",
        "oss:HeadObject"
      ],
      "Resource": [
        "acs:oss:*:*:my-img",
        "acs:oss:*:*:my-img/*"
      ]
    }
  ]
}
```

策略名 `ImageHostSingleBucket`。然后：

1. RAM → 用户 → 创建用户，勾选 **"使用永久 AccessKey 访问"**
2. 给这个用户**只挂**上面这一个策略
3. 生成 AK/SK，**立刻保存到本地密码管理器**

**几个故意的取舍：**

- **不给** `oss:ListBuckets` —— 泄露后连你有哪些桶都看不到
- **不给** `oss:CopyObject` —— 图床用不到复制权限，能少给就少给
- **不要挂** `AliyunOSSFullAccess` —— 那会让你的图床 AK 能读你的所有数据桶

#### 3.4 密钥存放纪律

- ❌ 不要写进代码、不要提交到 Git
- ✅ 只放在 FC 环境变量里
- 仓库根目录的 `.gitignore` 至少要有：

```
.env
.env.local
*.key
*.pem
*.p12
credentials.json
```

---

### 四、准备依赖层（Layer）

业务代码只依赖 `ali-oss`。把它做成 Layer，代码包就能保持在几 KB。

#### 方式 A：直接下载 Release 附件（推荐）

项目已发布 Release，`layer.zip` 与代码包都可直接下载：

**https://github.com/ezzty/oss-upload/releases/latest**

| 附件 | 大小 | 内容 |
| :--- | :--- | :--- |
| `layer.zip` | 3.25 MB | `ali-oss@6.23.0` 及其依赖，共 2338 个文件 |
| `oss-upload-code.zip` | 约 6 KB | `index.js` + `package.json`，函数部署包 |

**好处**：不用装 Node.js、不用打 zip，也不会因为你本地 `npm install` 拿到了更新版本的 SDK 而产生"和作者验证过的不一致"的问题。层内**只有 npm 包源码，没有密钥**。

#### 方式 B：自己构建

想换依赖版本、或不信任现成包时自己打：

```bash
mkdir -p layer-build/nodejs
cd layer-build
npm init -y
npm install ali-oss
# 目录必须是这个结构：
#   nodejs/
#     node_modules/
#       ali-oss/
#       ...它的传递依赖
cd nodejs && zip -r ../layer.zip node_modules && cd ..
```

#### 上传

**FC 控制台 → 层管理 → 创建层：**

- 名称：`oss-upload-deps`
- 运行时：**Node.js 18**
- 上传 `layer.zip`

> 层只需创建一次。以后升级 `ali-oss` 版本，重新打一个版本发布，再把函数指到新版本即可，不用改业务代码。

---

### 五、部署函数

### 5.1 获取业务代码

**推荐直接用 Release 附件**：https://github.com/ezzty/oss-upload/releases/latest 下载 `oss-upload-code.zip`（约 6 KB），解压后里面就是标准部署包。

自己打包的话，zip 根目录**只能有这两个文件**（不要套文件夹，否则 Handler 找不到 `index.handler`）：

```
code.zip
├── index.js        ← 业务源码
└── package.json    ← 声明依赖（供参考，实际运行时从层加载）
```

```bash
zip code.zip index.js package.json
```

#### 5.2 创建函数

- 运行时：**Node.js 18**
- 处理程序（Handler）：`index.handler`
- 规格：**0.05 vCPU / 128 MB 内存 / 512 MB 磁盘**（实测够用的最小规格）
- **层配置**：绑定刚才创建的 `oss-upload-deps`

> 内存这块要留神：代码把整个 body 读进内存（`bodyBuf`），base64 解码时还会产生一份副本。**128 MB 跑常规图片没问题**，但如果你把上传上限调到 20 MB 又常传接近上限的大图，内存得跟着往上调。

#### 5.3 环境变量（8 个必填，缺一个都起不来）

代码开头会逐个检查，缺失直接 `process.exit(1)`，函数返回 500 且日志里有 `❌ FATAL: Missing required environment variable: X`。

| 变量名 | 示例值（**占位符**） | 说明 |
| --- | --- | --- |
| `AUTH_USER` | `admin` | 登录用户名 |
| `AUTH_PASS` | `<请设置强密码>` | 登录密码，用随机长串 |
| `JWT_SECRET` | `<32位以上随机字符串>` | token 签名密钥 |
| `OSS_ACCESS_KEY_ID` | `LTAIxxxxxxxxxxxxxxxx` | RAM 用户的 AK |
| `OSS_ACCESS_KEY_SECRET` | `<你的 AccessKey Secret>` | RAM 用户的 SK |
| `OSS_BUCKET` | `my-img` | 桶名 |
| `OSS_REGION` | `oss-cn-hangzhou` | 桶所在地域 ID |
| `CDN_DOMAIN` | `https://img.example.com` | **必须带协议头**，否则启动即失败 |
| `ALLOWED_ORIGINS` | `example.com,myblog.net` | 允许跨域的来源，逗号分隔。**不在强制列表里**，**仅在启用代码级 CORS 时生效** |

![image](https://i.190808.xyz/m/26j13/f09581.png)


> 上表前 8 项是**强制**的（代码里 `requiredEnvVars` 就是这 8 个），第 9 项 `ALLOWED_ORIGINS` 不设也能启动。⚠️ 但它**只在「启用代码级 CORS」时才参与判断**——默认 CORS 由平台直接回显 `Origin`（控制台没有可配的地方），此时该变量不起作用。你若取消代码级 CORS 注释，则必须设它，否则兜底值 `example.com` 会把浏览器上传全拦死。

`ALLOWED_ORIGINS` 不用管——默认 CORS 不经过代码，`isValidOrigin` 根本不会被调用；只有按 5.4 启用代码级 CORS 时它才生效。

生成随机值：

```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 24   # AUTH_PASS
```

> `CDN_DOMAIN` 必须以 `http://` 或 `https://` 开头——代码里有专门的校验，忘了写协议头会直接终止启动。

#### 5.4 HTTP 触发器与 CORS

三种方式二选一，**默认就是「平台回显」**——网关直接把请求的 `Origin` 回显成 `Access-Control-Allow-Origin`，不校验来源：

| 方式 | 白名单 | 改代码 | 备注 |
| --- | --- | --- | --- |
| **API Configured CORS** | ✅ `allowOrigins` 数组 | 否 | **邀测**能力，需联系阿里云开通，走 API 配置，预检不计费 |
| **默认 CORS**（推荐，本文默认） | ❌ 无，直接回显 | 否 | 平台默认行为 |
| **代码级 CORS** | ✅ 自己写判断 | 是（`index.js` 的 CORS 块） | 预检会调用函数并计费 |

⚠️ **FC 控制台里没有「勾选允许跨域 / 填白名单域名」这样的选项**——已核对官方文档，白名单只能通过 API Configured CORS 的 `allowOrigins` 或代码级 CORS 配置，别照着某些教程去控制台里找这个开关。

⚠️ **不要同时开默认回显和代码级 CORS**：函数返回的头会与平台回显合并，可能产生重复的 `Access-Control-Allow-Origin`，浏览器会直接报错。

**个人图床的建议**：先用默认 CORS 就够。它确实放行任意 `Origin`，但那只是「浏览器放不放行」，真正的门是 token 鉴权——没 token 照样 `401`（见 9.2 探针）。要收紧就申请开通 API Configured CORS，配 `allowOrigins: ["https://your-site.com"]`（⚠️ 它**不支持子域通配**，要逐个枚举）。

#### 5.5 绑定自定义域名

FC 控制台 → 域名管理 → 添加域名 → 按提示配 CNAME 和证书。这样你才有 `https://api.example.com` 这样的 API 地址。

---

### 六、前端页面

`upload.html` 是个单文件前端，直接扔到你自己的网站目录即可。

**必须改一处**，找到 `_FC_PARTS`：

```javascript
// 改成你的函数计算自定义域名
const _FC_PARTS = ['https://', 'api.example.com'];
```

**体积上限要和后端对齐**（默认都是 20MB）：

```javascript
if (file.size > 20 * 1024 * 1024) { /* 拦截 */ }
```

前后端各有一道限制，**以小的那个为准**。只改前端不改后端，大文件会在服务端被 413 掉；只改后端不改前端，用户在浏览器就被拦住了，根本发不出去。

#### 6.1 发送方式：别直接 `xhr.send(File)`（iOS 会丢 body）

```javascript
// ❌ 写起来最自然，但 iOS Safari 上服务端收到 0 字节
xhr.send(currentFile);

// ✅ 先读成 ArrayBuffer 再发
const buf = await currentFile.arrayBuffer();
xhr.setRequestHeader('Content-Type', currentFile.type || 'application/octet-stream');
xhr.send(buf);
```

这个坑的**诊断特征**很典型：桌面和安卓都正常，**iOS 必失败**，大小图都一样；服务端打印收到的请求头，显示 `Content-Length: 0`、`rawLen=0`、`te=none`，而前端明明 `file.size = 5311352`。**body 是在浏览器发出去之前就没写**，不是网关截断、不是格式问题。

两个配套细节：

- **必须显式设 `Content-Type`**：`ArrayBuffer` 发出去默认是 `application/octet-stream`，会被 MIME 白名单拒掉
- **别加自定义请求头**（比如 `X-Client-Size` 之类的调试头）：预检的 `Access-Control-Allow-Headers` 是固定值 `content-type, authorization`，多一个头浏览器会直接把请求拦下，症状变成"完全发不出去"

> 排查这类问题别靠猜：在前端把 `file.size`、在服务端把 `rawLen`/`content-length` **两边都打印出来对比**，一行数据就能定案。

---

### 七、核心代码讲解

#### 7.1 环境变量硬校验

```javascript
const requiredEnvVars = ['AUTH_PASS', 'OSS_ACCESS_KEY_ID', ...];
for (const key of requiredEnvVars) {
    if (!process.env[key]) { console.error(`❌ FATAL: ${key}`); process.exit(1); }
}
```

宁可启动失败，也不带着残缺配置对外服务——否则会出现"登录正常但上传全挂"这类难查的半残状态。

#### 7.2 登录请求体 4KB 上限

```javascript
if (bodyBuf.length > CONFIG.SECURITY.MAX_LOGIN_BODY_SIZE) {  // 4KB
    return { statusCode: 413, ... };
}
```

**这是个容易被忽略的防护**：`/login` 只需要 `{user, pass}` 两个字段，但如果没有体积上限，攻击者可以 POST 一个 10MB 的 body 让服务端做 `JSON.parse`，用极小的代价打满内存。4KB 足够装下正常登录请求，超了直接 413，**连 JSON 解析都不进**。

> 这个检查必须放在 `JSON.parse` **之前**才有效。

#### 7.3 上传体积双重校验

```javascript
// 第一道：看 Content-Length 头
const cl = parseInt(hdrs['content-length'] || '0', 10);
if (cl > 20 * 1024 * 1024) return 413;

// 第二道：看真实 body 长度（兜底）
if (bodyBuf.length > maxUploadSize) return 413;
```

只信 `Content-Length` 是危险的——它由客户端声明，可以伪造小数值绕过检查。**必须再量一次真实字节数**。

#### 7.4 MIME 白名单 + 魔数检测

```javascript
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'
]);
```

`Content-Type` 头同样是客户端说了算，所以还要读文件头字节判断真实类型：

| 类型 | 魔数 |
| --- | --- |
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| GIF | `47 49 46 38 39/61 61` |
| WebP | `RIFF....WEBP`（RIFF + 偏移 8 处 WEBP） |
| BMP | `42 4D` |

两道都过才存。这样即使有人把 `.php` 重命名为 `.jpg` 上传，服务端也会因为魔数对不上而拒绝。

### 7.5 自实现 Token（HMAC 签名）

不引第三方 JWT 库，自己拼一个四段式 token：

```
token = username . 过期时间戳 . jti . HMAC-SHA256(username.exp.jti, JWT_SECRET)
```

四个安全点：

1. `crypto.timingSafeEqual` **常数时间比较** —— 不用 `===`，避免通过响应耗时逐字节猜签名（时序攻击）
2. `jti`**（8 字节随机）保证每次签发不同** —— ⚠️ 注意它**不防重放**：没有服务端存储，同一 token 在 24h 内可重复使用。要防重放得上 Redis/Tablestore 做黑名单，个人图床不划算；token 泄露就改 `JWT_SECRET` 重启函数，旧 token 全部作废
3. **24 小时过期** —— 过期时间是签名的一部分，改不了
4. **校验用户名** —— token 必须对得上当前配置的 `AUTH_USER`，换密码/换用户后旧 token 自动失效

#### 7.6 IP 防爆破

```javascript
MAX_LOGIN_ATTEMPTS: 5,        // 失败 5 次
LOCK_DURATION_MS: 15 * 60 * 1000   // 锁 15 分钟
```

内存级计数，**上限 1000 条 + 惰性清理**（每次 `/login` 时顺带清过期项，不依赖 `setInterval`——FC 实例空闲会被冻结销毁，定时器不一定活着）。**注意这是单实例内存**——FC 多实例并发时不共享，所以它挡的是"同一个连接上的暴力尝试"，不是分布式撞库。真要防分布式，需要接 WAF 或验证码。

两个实现细节值得照抄：

```javascript
const loginAttempts = new Map();      // ⚠️ 用 Map，不要用普通对象 {} —— 见下
const isValidIp = (ip) =>
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]{3,45}$/.test(ip);
```

**为什么必须是 `Map`**：防爆破表的键来自请求头。如果用 `{} ` 而客户端送 `X-Forwarded-For: __proto__`，执行 `loginAttempts[ip].count += 1` 就会把 `count` 写进 `Object.prototype`，**污染进程里所有空对象**（实测 `{}.__proto__.count` 变成 `NaN`，且之后每个空对象都凭空多出 `count` 属性）。`Map` 天然免疫，再加 IP 格式校验把特殊键挡在门外。

**IP 从哪拿**：优先 `requestContext.http.sourceIp`（FC 平台注入、客户端改不了），`X-Forwarded-For` 最左值是客户端可控的，只能当兜底。

#### 7.7 来源白名单

```javascript
const ALLOWED_HOSTS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : ['<你的域名>'];   // ⚠️ 这是代码里的兜底值，部署时请务必用 ALLOWED_ORIGINS 环境变量覆盖

const isValidOrigin = (origin) => {
    const h = new URL(origin).hostname;
    return ALLOWED_HOSTS.some(d => h === d || h.endsWith('.' + d));
};
```

- 支持**子域通配**：填 `example.com` 则 `www.example.com`、`blog.example.com` 都放行
- `ALLOWED_ORIGINS` **启用代码级 CORS 时一定要自己配**，别依赖代码里的兜底值
- 没有 Origin 头的请求放行（服务端脚本、curl 调试场景）

#### 7.8 安全响应头

```javascript
'x-content-type-options': 'nosniff',
'strict-transport-security': 'max-age=31536000; includeSubDomains',
'cache-control': 'no-store'          // 登录返回的 token 不许被中间层缓存
```

`nosniff` 阻止浏览器把 JSON 当脚本执行，HSTS 强制 HTTPS，`no-store` 防止 CDN/代理 缓存住登录响应里的 token。

⚠️ **已知平台行为**：如果通过 **FC 自定义域名**访问，这两个头可能被平台层剥掉，用 `curl -I` 看不到。这不是代码 bug，别为它去改代码。

#### 7.9 FC 事件格式兼容

```javascript
const path = parsedEvent.rawPath || parsedEvent.path || parsedEvent.pathName || '/';
const method = (((rc.http && rc.http.method) || parsedEvent.httpMethod
                 || hdrs['x-http-method-override'] || 'GET') + '').toUpperCase();

// 惰性解码：先用未解码长度粗判，鉴权通过后才真正分配 Buffer
const rawBody = parsedEvent.body || '';
const approxBytes = parsedEvent.isBase64Encoded
    ? Math.floor(String(rawBody).length * 3 / 4)
    : Buffer.byteLength(String(rawBody));

let _bodyBuf = null;
const decodeBody = (encoding) => {      // ← 编码必须显式指定，见下
    if (_bodyBuf === null) {
        _bodyBuf = parsedEvent.isBase64Encoded
            ? Buffer.from(String(rawBody), 'base64')
            : Buffer.from(String(rawBody), encoding || 'utf8');
    }
    return _bodyBuf;
};

// /login → decodeBody()          JSON 文本，按 utf8 还原（中文密码也能正确解析）
// /upload → decodeBody('binary')  图片字节流，见下文的坑
```

FC 不同版本的 HTTP 触发器事件结构不一样，而且**二进制 body 常常被 base64 编码**。不处理 `isBase64Encoded`，你会收到一坨 base64 文本然后魔数校验永远失败——这是新人最常见的翻车点。

⚠️ **但别一进 handler 就解码**：那意味着任何未认证的请求都能让你先分配几十 MB Buffer（FC 规格才 128 MB）。正确顺序是**先判路径 → 再鉴权 → 最后解码**，长度粗判用 `approxBytes` 就够（base64 解码后约 `len × 3/4`，无需真解）。

⚠️ **更隐蔽的坑：未编码的二进制 body 不能按 UTF-8 解**。`Buffer.from(str)` 默认就是 `utf8`，图片字节流里的高位字节（比如 PNG 头的 `0x89`）不是合法 UTF-8，会被解码成替换字符 `�`，**字节就永久毁了**——于是魔数校验对一张正常图片也永远失败，报 `Invalid file content`。这与"没处理 `isBase64Encoded`"症状一模一样，但按那条思路查会走进死胡同。

实测踩坑过程：桌面浏览器和安卓都传得好好的，**iOS 必失败**，服务端把收到的头打印出来才发现 `Content-Length: 0` / `rawLen=0`——根因其实在前端（iOS Safari 对 `xhr.send(File)` 会丢 body，见第六章），但**顺带暴露了这个解码 bug**：只要客户端不走 base64 编码，`Buffer.from(str)` 这条路就必然毁字节。

修法就是上面代码里的 `decodeBody('binary')`（`'binary'` 即 latin1，一个字符对应一个字节，不会损坏高位字节）。**只在图片那条路径用**；登录 body 是 JSON 文本，必须按 utf8 解，否则中文用户名/密码会乱码。

---

### 八、路径规划与图片处理

#### 8.1 短路径格式

```
m/YY{月字母}DD/{6位随机hex}.{ext}
```

例如 `m/26j13/ab12cd.jpg` = **2026 年 10 月 13 日**上传。

月字母对照（`'abcdefghijkl'[month]`）：

| 月份 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 字母 | a | b | c | d | e | f | g | h | i | **j** | k | l |

**生成代码：**

```javascript
const d = new Date(Date.now() + 8 * 3600 * 1000);   // 北京时间
const yy = String(d.getUTCFullYear()).slice(2);
const mon = 'abcdefghijkl'[d.getUTCMonth()];
const dd  = String(d.getUTCDate()).padStart(2, '0');
const key = `m/${yy}${mon}${dd}/${crypto.randomBytes(3).toString('hex')}${ext}`;
```

三个要点：

1. `+8小时` **再取 UTC 分量** —— FC 默认跑在 UTC，不加偏移的话，北京时间 0:00~7:59 上传的图片会落到**前一天**的目录里
2. **随机名用** `randomBytes(3)` **= 6 位十六进制** —— 约 1677 万种组合，配合"每日一个目录"几乎不可能覆盖已有文件；不要用 4 位（日上传量稍大就有碰撞风险）
3. **去掉** `img/` **之类的层级** —— 每省一个目录层级，URL 短一截

#### 8.2 OSS 图片处理（强烈推荐）

OSS 自带图片处理，URL 后面加参数即可实时生成缩略图，**不占用额外存储**：

```yaml
https://img.example.com/m/26j13/ab12cd.jpg?x-oss-process=style/w950
```

先在 OSS 控制台创建样式 `w950`（宽 950px、自动转 WebP、质量自适应）。

**实测效果**（真实数据）：

|  | 大小 |
| --- | --- |
| 原图 | 1.89 MB |
| `?x-oss-process=style/w950` | **81 KB（省 96%）** |

网页里引用大图是浪费带宽的头号原因——**正文永远用样式 URL，点击看原图**。

---

### 九、上线验收（每一条都能抓到真问题）

部署完别急着宣布成功，按顺序跑：

#### 9.1 结构探针：确认新代码已生效

```bash
python3 -c "
import urllib.request, json
body = json.dumps({'password': 'x' * 10000}).encode()   # 10KB 登录体
req = urllib.request.Request('https://api.example.com/login',
      data=body, method='POST', headers={'Content-Type': 'application/json'})
try:
    urllib.request.urlopen(req, timeout=20)
except Exception as e:
    print('HTTP', getattr(e, 'code', '?'))
"
```

**期望：**`413`（`Request too large`）

- 返回 413 → 新代码（带 4KB 检查）已生效 ✅
- 返回 200/401 → **线上跑的是旧代码**，检查你上传的部署包是不是最新的 ⚠️

**同款思路，验方法限制**（新版只收 POST，旧版没这道防线）：

```bash
# 不带 body 的 GET —— 新版应返回 405
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/login
```

期望 `405`（`Method Not Allowed`）；返回 `400` 或 `401` 就说明线上还是旧版代码。

> 这一招是本文最有价值的运维技巧：**代码改动有没有真正上线，一个探针就能验出来**，不靠"我明明传了啊"。

#### 9.2 鉴权探针

```bash
# 错误 token → 期望 401
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://api.example.com/upload \
  -H "Authorization: Bearer wrong" -H "Content-Type: image/jpeg" --data-binary @test.jpg
```

期望 `401`；如果返回 400/200，说明鉴权被绕过，立刻停服排查。

#### 9.3 真实上传

在页面上传一张图，确认返回：

```json
{"success":true,"markdown":"![image](https://img.example.com/m/26j13/ab12cd.jpg)","direct":"..."}
```

#### 9.4 **关键：去 OSS 核实对象真的存在**

```python
import oss2
auth = oss2.Auth('<AK>', '<SK>')
b = oss2.Bucket(auth, 'https://oss-cn-hangzhou.aliyuncs.com', 'my-img')
print('存在:', b.object_exists('m/26j13/ab12cd.jpg'))
```

**为什么必须做这一步**：CDN 有缓存。一张**已经从 OSS 删掉的图片**，CDN 节点还可能继续返回 `200` 很长时间。只 curl CDN 会得到"一切正常"的假象，而实际上新上传根本没写进去（典型原因：RAM 策略没给 `PutObject`）。

**上传验证 = CDN 200 + OSS 里对象确实存在**，两个都对才算数。

#### 9.5 上线前安全清单

- [ ] Bucket 是**私有**读写
- [ ] RAM 用户**只挂单桶策略**，无 `ListBuckets`、无 `FullAccess`
- [ ] AK/SK 不在代码里、不在 Git 里
- [ ] `AUTH_PASS` 是随机长串，不是弱口令
- [ ] `JWT_SECRET` 是随机串，且与密码不同
- [ ] `ALLOWED_ORIGINS` 已改成你自己的域名（**仅当启用代码级 CORS 时需要**）
- [ ] 9.1 探针返回 413
- [ ] 9.2 探针返回 401
- [ ] 前后端体积限制一致（20MB）

---

### 十、成本

按量付费，三块：

| 项目 | 计费方式 | 量级参考 |
| --- | --- | --- |
| **FC 计算** | 计算 CU（vCPU+内存×时长）+ 调用次数 | 有免费额度，个人图床通常在额度附近 |
| **OSS 存储** | 元/GB/月 | 标准存储约 **0.09~0.12 元/GB/月** |
| **OSS 请求** | 按次 | 极低，可忽略 |
| **流量** | 元/GB | 见下 |

**流量是账单大头，也是最容易优化的：**

- **上传到 OSS：免费**
- **OSS 内网（FC ↔ OSS 同地域）：免费**
- **OSS 外网流出：收费**（约 0.5 元/GB 量级，按时段与地域不同）
- **走 CDN：CDN 回源走内网，回源流量免费**，只按 CDN 流量计费

**结论：图床一定要挂 CDN**，既提速又能绕开 OSS 外网流出费。另外注意 FC 与 OSS **必须同地域**，跨地域会走公网，既慢又可能产生额外流量。

博主实测，如果一个月上传几十张图,一个月的费用大概为1元钱左右。

> 以上单价为撰写时的量级参考，**实际以**[**阿里云定价页**](https://www.aliyun.com/price/detail/oss)**和价格计算器为准**。

---

### 十一、常见坑速查

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 函数 500，日志 `Cannot find module 'ali-oss'` | 层没绑，或层目录结构不是 `nodejs/node_modules/` | 重建层并绑定 |
| 500，日志 `❌ FATAL: Missing required environment variable` | 环境变量缺项 | 补齐 8 个（`ALLOWED_ORIGINS` 可选） |
| 魔数校验永远失败，收到的是文本 | body 被 base64 编码未解 | 检查 `isBase64Encoded` 分支 |
| 魔数校验永远失败，但图片**没走 base64** | 未编码 body 按 UTF-8 解码，高位字节被毁 | `/upload` 用 `decodeBody('binary')`，见 7.9 |
| 只有 iOS 上传失败，安卓/桌面正常；服务端 `rawLen=0` | iOS Safari 对 `xhr.send(File)` 丢 body | 先 `await file.arrayBuffer()` 再发，见 6.1 |
| 上传成功但 URL 404 | `CDN_DOMAIN` 没配域名/没绑证书 | 补配 CDN 域名 |
| 本地代码改了，线上行为没变 | 部署包不是最新的 | 跑 9.1 探针确认 |
| 预览图显示了但 OSS 里没有 | `blob:` URL 是**本地内存地址**，选中文件就生成，不代表已上传 | 以上传成功回调为准 |
| 凌晨上传的图落到前一天目录 | FC 用 UTC 取日期 | 用 `+8小时` 偏移 |
| 自定义域名下看不到 `nosniff`/HSTS 头 | 平台层剥掉了 | 平台行为，不是 bug |
| 报 CORS 错（`Access-Control-Allow-Origin` 重复或无效） | 默认回显 + 代码级 CORS 同时开 | 二选一，见 5.4 |
| `GET /login` 返回 400/401 而不是 405 | 线上是旧版代码（新版只收 POST） | 重新上传部署包 |

---

### 十二、维护更新

**改业务代码（比如图片链接形式）：**

1. 改本地 `index.js`
2. `zip code.zip index.js package.json`
3. 控制台 → 代码部署 → 上传 → 部署
4. **跑 9.1 探针确认新版本生效**

**改前端：**

1. 改 `upload.html`
2. 上传到网站，建议设 `Cache-Control: no-cache`，否则用户可能拿到旧版

**升级依赖：**

1. 重新 `npm install ali-oss` 并打包 `layer.zip`
2. 控制台发布新层版本
3. 函数切换到新层版本

**换密钥（定期做）：**

1. RAM 生成新 AK/SK
2. 更新 FC 环境变量 → 部署
3. 确认服务正常后，**在 RAM 控制台禁用旧 AK**

---

### 十三、参考

- 源码：https://github.com/ezzty/oss-upload
- [阿里云函数计算文档](https://help.aliyun.com/zh/functioncompute/)
- [阿里云 OSS 产品定价](https://www.aliyun.com/price/detail/oss)
- [函数计算计费说明](https://help.aliyun.com/zh/functioncompute/billing-overview-of-fc)