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

**个人图床的建议**：先用默认 CORS 就够。它确实放行任意 `Origin`，但那只是「浏览器放不放行」，真正的门是 token 鉴权——没 token 照样 `401`（README 有鉴权探针）。要收紧就申请开通 API Configured CORS，配 `allowOrigins: ["https://your-site.com"]`（⚠️ 它**不支持子域通配**，要逐个枚举）。

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

### 七、想深入？核心细节都在源码 README

以上就是跑通自建图床的完整流程。**代码为什么这么写、每层防护的实现细节、完整验收清单**，都整理在源码仓库的 README 里，需要时对着看：

**https://github.com/ezzty/oss-upload** → `README.md` 的「🧩 核心实现（代码级）」与「🧪 上线验收」

那里有这里没展开的内容：

- **Token 结构与四个安全点**（HMAC 签名、常数时间比较、防重放的边界）
- **魔数检测对照表**（JPEG / PNG / GIF / WebP / BMP 的文件头字节）
- **体积三重校验**、登录体 4KB 上限、IP 防爆破为什么必须用 `Map`（`X-Forwarded-For: __proto__` 原型污染实测）
- **FC 事件格式兼容与 body 解码**（含两个大坑：惰性解码、未编码二进制不能按 UTF-8 解）
- **前端发送方式**（iOS Safari 会丢 `xhr.send(File)` 的 body，要改用 ArrayBuffer）
- **OSS 图片处理**（实测 1.89 MB → 81 KB，省 96%）
- **完整上线验收清单**（探针命令 + OSS 核实脚本 + 安全 checklist）

> 博客正文只想讲清楚「为什么自建、怎么跑起来、要注意什么」；真要动手部署，README 就是完整技术文档。

---


### 八、成本

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

---

### 九、常见坑速查

| 现象                                                      | 原因                                     | 解决                                                |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| 函数 500，日志 `Cannot find module 'ali-oss'`                | 层没绑，或层目录结构不是 `nodejs/node_modules/`    | 重建层并绑定                                            |
| 500，日志 `❌ FATAL: Missing required environment variable` | 环境变量缺项                                 | 补齐 8 个（`ALLOWED_ORIGINS` 可选）                      |
| 魔数校验永远失败，收到的是文本                                         | body 被 base64 编码未解                     | 检查 `isBase64Encoded` 分支                           |
| 魔数校验永远失败，但图片**没走 base64**                               | 未编码 body 按 UTF-8 解码，高位字节被毁             | `/upload` 用 `decodeBody('binary')`，见 README「核心实现」 |
| 只有 iOS 上传失败，安卓/桌面正常；服务端 `rawLen=0`                      | iOS Safari 对 `xhr.send(File)` 丢 body   | 先 `await file.arrayBuffer()` 再发，见 6.1             |
| 上传成功但 URL 404                                           | `CDN_DOMAIN` 没配域名/没绑证书                 | 补配 CDN 域名                                         |
| 本地代码改了，线上行为没变                                           | 部署包不是最新的                               | 跑 README 验收探针确认                                   |
| 预览图显示了但 OSS 里没有                                         | `blob:` URL 是**本地内存地址**，选中文件就生成，不代表已上传 | 以上传成功回调为准                                         |
| 凌晨上传的图落到前一天目录                                           | FC 用 UTC 取日期                           | 用 `+8小时` 偏移                                       |
| 自定义域名下看不到 `nosniff`/HSTS 头                              | 平台层剥掉了                                 | 平台行为，不是 bug                                       |
| 报 CORS 错（`Access-Control-Allow-Origin` 重复或无效）           | 默认回显 + 代码级 CORS 同时开                    | 二选一，见 5.4                                         |
| `GET /login` 返回 400/401 而不是 405                         | 线上是旧版代码（新版只收 POST）                     | 重新上传部署包                                           |

---

### 十、维护更新

**改业务代码（比如图片链接形式）：**

1. 改本地 `index.js`
2. `zip code.zip index.js package.json`
3. 控制台 → 代码部署 → 上传 → 部署
4. **跑 README 验收探针确认新版本生效**

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

### 十一、参考

- 源码：https://github.com/ezzty/oss-upload
- [阿里云函数计算文档](https://help.aliyun.com/zh/functioncompute/)
- [阿里云 OSS 产品定价](https://www.aliyun.com/price/detail/oss)
- [函数计算计费说明](https://help.aliyun.com/zh/functioncompute/billing-overview-of-fc)