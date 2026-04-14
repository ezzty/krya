---
title: 基于 Hermes Agent 的企业网站开发实践
pubDate: 2026-04-11
author: Jin
draft: false
---

## 前言

因为没有Cursor和Claude，最近使用 Hermes Agent 完成了一个企业网站的开发项目，从需求分析到代码部署，全程由 AI 助手协助完成。这篇文章总结一下开发过程中的技术要点和实践经验。

---

## 项目需求

为一个企业开发官方网站，需要以下功能：

1. **产品展示** - 多个产品系列的图片展示
2. **公司介绍** - 企业背景、业务范围
3. **客户留言** - 潜在客户提交咨询信息
4. **管理后台** - 查看客户留言数据
5. **极低成本** - Serverless，免于维护，最低成本运行

---

## 技术架构

### 前端

- 单页 HTML 网站，响应式设计
- 毛玻璃效果导航栏
- 产品图片轮播展示
- 联系表单提交

### 后端

- 阿里云函数计算（Function Compute）
- Python 3.10 运行环境
- HTTP 触发器
- OSS 对象存储（留言数据持久化）

### 安全设计

- Bearer Token 认证（触发器级别）
- 管理密码验证（函数级别）
- 双 Token 分离机制
- IP 限流保护

---

## 核心功能实现

### 1. 留言提交接口

```
# POST /submit - 留言提交
if '/submit' in raw_path:
    data = json.loads(body)
    
    # 获取客户端信息
    client_ip = get_client_ip(event)
    browser_info = parse_user_agent(user_agent)
    ip_location = get_ip_location(client_ip)
    
    # 保存到 OSS
    messages.append({
        'name': data['name'],
        'phone': data['phone'],
        'message': data['message'],
        'ip': client_ip,
        'location': ip_location,
        'browser': browser_info
    })
```

### 2. IP 地址获取

阿里云函数计算的 HTTP 触发器中，客户端 IP 存储在 `requestContext.http.sourceIp` 字段：

```
def get_client_ip(event):
    request_context = event.get('requestContext', {})
    http_info = request_context.get('http', {})
    return http_info.get('sourceIp', 'unknown')
```

### 3. IP 归属地查询

使用淘宝 IP 库 API（免费，无需 API Key）：

```
def get_ip_location(ip):
    url = f'http://ip.taobao.com/outGetIpInfo?ip={ip}&accessKey=alibaba-inc'
    data = urllib.request.urlopen(url).json()
    return data['data']['region'].rstrip('省市')
```

### 4. 浏览器信息识别

解析 User-Agent header：

```
def parse_user_agent(ua):
    browser = 'Chrome' if 'Chrome' in ua else '未知'
    os_name = 'Windows' if 'Windows' in ua else '未知'
    device = 'Mobile' if 'Mobile' in ua else 'Desktop'
    return f"{browser} / {os_name} / {device}"
```

### 5. 双 Token 认证机制

**触发器 Token**（阿里云验证）：

- 通过 `Authorization: Bearer <token>` 发送
- 所有请求都必须携带

**管理密码**（函数代码验证）：

- 通过 `X-Admin-Password` header 发送
- 只有 `/messages` 接口需要

```
# GET /messages - 双 Token 验证
if '/messages' in raw_path:
    admin_password = req_headers.get('X-Admin-Password')
    if admin_password != ADMIN_PASSWORD:
        return {'statusCode': 401, 'body': '{"error":"密码错误"}'}
```

---

## 安全建议

1. **密码分离** - 前端 Token 与后台密码独立
2. **环境变量** - 敏感信息不硬编码
3. **IP 限流** - 防止恶意刷留言
4. **HTTPS** - 生产环境强制使用
5. **定期更换** - Token 和密码每 3-6 个月更换

---

## 总结

这次开发实践验证了 Hermes Agent 在实际工作场景中的能力：

- ✅ 完整的代码生成能力
- ✅ 问题诊断和修复能力
- ✅ 安全最佳实践建议
- ✅ 部署流程指导

对于小型企业网站项目，AI 助手可以完成从开发到部署的全流程，大幅降低开发成本和时间。

---

**标签**：Hermes Agent, 阿里云，函数计算，Python, 企业网站
