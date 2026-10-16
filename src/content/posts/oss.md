---
title: 低成本自建阿里云函数计算FC+OSS图床
description: 很多自建图床方案都要自备服务器，月租几十块还得自己打补丁；或者有一些图床只能在本地客户端运行，换个电脑就不能上传；最终我决定做一个 Serverless 的云端图床方案，随时随地，想传就传。阿里云函数计算FC + OSS，FC 按量付费（低流量≈0 元）+ 无数据库 + 免运维，部署包低至 6KB。低频上传几乎零开支，用自带的 `*.fcapp.run` 域名连备案都省了，想换自定义域名再绑。
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
![image](https://i.190808.xyz/m/26j16/20b3f2.png?x-oss-process=style/w950)

**先说三件事：**

1. 本图床功能简单，配置容易，足够安全；如果不够用，源码丢给Ai，极易增删功能。
2. 本文所有 `AccessKey`、密码、域名、Bucket 名都是占位符，照抄前请替换成你自己的。
3. 代码是单文件 Node.js（约 380 行），依赖通过 FC 层（Layer） 注入，业务代码零硬编码，全部配置走**环境变量**。

> 源码：https://github.com/ezzty/oss-upload

---

### 一、为什么自建图床

每一个静态博客基本都得有图床。好多人图省钱，用别人的永久免费图床；但是哪个大善人永不跑路呢？而且数据在他人之手，自己毫无主动权，难免提心吊胆。

踩了很多坑之后，决定自己做一个极低成本的图床。主要目的就是省钱、不限容量、安全！

很多自建图床方案都要自备服务器，月租几十块还得自己打补丁；或者有一些图床只能在本地客户端运行，换个电脑就不能上传；最终我决定做一个 Serverless 的云端图床方案，随时随地，想传就传。

**阿里云函数计算 FC + OSS + CDN**

FC 按量付费（低流量≈0 元）+ 无数据库 + 免运维，部署包低至 6KB。低频上传几乎零开支。

OSS 图片存储按量付费，几十 GB 的图片一个月也就几块钱。

套上 CDN，图片加载快到飞起！

虽然个人图床，攻击价值不大；但是也做了多层安全设计：强制 PoW 防爆破、魔数校验防伪装、三重体积防灌包、日配额防滥用、Token 2 小时防盗用。

我这个方案也不是没有缺点：没有多用户、没有相册管理、没有用量统计；甚至删除图片，也只能进 OSS 控制台删。

但是它小啊，成本低，个人使用足够了。

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

函数配置的环境变量有8个必填项，按照图片里面配置。

- **`AUTH_USER`** `admin` —— 登录用户名
- **`AUTH_PASS`** `<请设置强密码>` —— 登录密码，用随机长串
- **`JWT_SECRET`** `<32位以上随机字符串>` —— token 签名密钥
- **`OSS_ACCESS_KEY_ID`** `LTAIxxxxxxxxxxxxxxxx` —— RAM 用户的 AK
- **`OSS_ACCESS_KEY_SECRET`** `<你的 AccessKey Secret>` —— RAM 用户的 SK
- **`OSS_BUCKET`** `my-img` —— 桶名
- **`OSS_REGION`** `oss-cn-hangzhou` —— 桶所在地域 ID
- **`CDN_DOMAIN`** `https://img.example.com` —— **必须带协议头**，否则启动即失败

**1 个可选：**

- **`ALLOWED_ORIGINS`** `example.com,myblog.net` —— 允许跨域来源，逗号分隔。不设也能启动；它**只在启用代码级 CORS 时才参与判断**（默认 CORS 由平台直接回显 `Origin`，`isValidOrigin` 根本不会被调用）。若启用代码级 CORS 则必须设它，否则兜底值 `example.com` 会把浏览器上传全拦死。

![image](https://i.190808.xyz/m/26j13/f09581.png)

#### 5.4 绑定自定义域名

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

---

### 七、想深入？核心细节都在源码 README

以上就是跑通自建图床的完整流程。**代码为什么这么写、每层防护的实现细节、完整验收清单**，都整理在源码仓库的 README 里，需要时对着看：

**https://github.com/ezzty/oss-upload** → `README.md` 的「核心实现（代码级）」与「上线验收」

博客正文只想讲清楚「为什么自建、怎么跑起来、要注意什么」；真要动手部署，README 就是完整技术文档。

---

### 八、成本

按量付费，三块：

| 项目         | 计费方式                    | 量级参考                       |
| ---------- | ----------------------- | -------------------------- |
| **FC 计算**  | 计算 CU（vCPU+内存×时长）+ 调用次数 | 有免费额度，个人图床通常在额度附近          |
| **OSS 存储** | 元/GB/月                  | 标准存储约 **0.09~0.12 元/GB/月** |
| **OSS 请求** | 按次                      | 极低，可忽略                     |
| **CDN流量**  | 元/GB                    | 见下                         |

**流量是账单大头，也是最容易优化的：**

- **上传到 OSS：免费**
- **OSS 内网（FC ↔ OSS 同地域）：免费**
- **OSS 外网流出：收费**（约 0.5 元/GB 量级，按时段与地域不同）
- **走 CDN：CDN 回源走内网，回源流量免费**，只按 CDN 流量计费

**结论：图床一定要挂 CDN**，既提速又能绕开 OSS 外网流出费。另外注意 FC 与 OSS **必须同地域**，跨地域会走公网，既慢又可能产生额外流量。

博主实测，如果一个月上传几十张图,一个月的费用大概为1元钱左右。

---

### 九、维护更新

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

### 十、参考

- 源码：https://github.com/ezzty/oss-upload
- [阿里云函数计算文档](https://help.aliyun.com/zh/functioncompute/)
- [阿里云 OSS 产品定价](https://www.aliyun.com/price/detail/oss)
- [函数计算计费说明](https://help.aliyun.com/zh/functioncompute/billing-overview-of-fc)