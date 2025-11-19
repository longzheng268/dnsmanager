# Cloudflare Workers 边缘加速部署

**原作者**: 消失的彩虹海 - [彩虹聚合DNS管理系统](https://blog.cccyun.cn)  
**Workers集成**: longzheng268 - [个人主页](https://www.lz-0315.com)

---

## 什么是Workers边缘加速？

Cloudflare Workers为您的DNS Manager PHP项目提供**全球边缘加速**，让全球用户都能快速访问您的系统。

**工作原理：**
```
用户 → Cloudflare全球边缘节点(Workers) → 您的PHP后端 → 响应缓存到边缘 → 用户
```

**优势：**
- ⚡ 全球200+数据中心，就近访问
- 🚀 智能缓存，重复请求秒级响应
- 🔒 自动DDoS防护
- 💰 免费套餐每天10万请求

---

## 快速开始

## 快速开始

### 前提条件

1. 已部署好DNS Manager PHP项目（VPS、云服务器、Docker等）
2. 拥有 [Cloudflare账号](https://dash.cloudflare.com/sign-up)
3. 已安装 [Node.js](https://nodejs.org/) v18+

### 步骤1：安装依赖

在项目根目录运行：

```bash
npm install
```

### 步骤2：配置后端地址

编辑项目根目录的 `wrangler.jsonc` 文件：

```jsonc
{
  "name": "dnsmanager",
  "main": "worker/src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  
  "vars": {
    "BACKEND_URL": "https://your-actual-backend.com"  // ← 修改这里
  }
}
```

将 `BACKEND_URL` 改为您实际的PHP后端地址。

### 步骤3：一键部署

```bash
# 首次使用需要登录Cloudflare
npx wrangler login

# 部署Workers
npm run deploy
```

完成！您的DNS Manager现在拥有全球边缘加速了。

---

## 配置说明

### 核心配置

在 `wrangler.jsonc` 中配置：

| 配置项 | 必需 | 说明 |
|--------|------|------|
| `BACKEND_URL` | 是 | 您的PHP项目实际部署地址，如 `https://dns.example.com` |

### 高级配置（可选）

```jsonc
{
  // ... 基础配置 ...
  
  // 自定义域名
  "routes": [
    {
      "pattern": "dns.yourdomain.com/*",
      "zone_name": "yourdomain.com"
    }
  ],
  
  // KV缓存（提升性能）
  "kv_namespaces": [
    {
      "binding": "DNS_CACHE",
      "id": "your-kv-id"
    }
  ]
}
```

---

## 使用自定义域名

1. 在Cloudflare添加您的域名
2. 在 `wrangler.jsonc` 中配置routes
3. 重新部署：`npm run deploy`

或者通过Cloudflare Dashboard配置：
1. 进入 [Workers & Pages](https://dash.cloudflare.com)
2. 选择您的Worker
3. 点击 "Triggers" → "Add Custom Domain"

---

## 本地开发测试

```bash
# 启动本地开发服务器
npm run worker:dev

# 访问 http://localhost:8787 测试
```

---

## 监控和日志

### 查看实时日志

```bash
npx wrangler tail
```

### 查看分析数据

访问 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → 选择您的Worker → Metrics

---

## 常见问题

### Worker无法连接到后端

**检查：**
1. BACKEND_URL是否正确（包括https://）
2. 后端服务器是否正常运行
3. 后端是否允许Cloudflare IP访问

### 如何更新Worker

修改配置后重新运行：
```bash
npm run deploy
```

### 如何删除Worker

```bash
npx wrangler delete
```

---

## 架构说明

```
┌─────────┐     请求      ┌──────────────────┐     转发      ┌─────────────┐
│  用户   │ ────────────> │ Cloudflare Edge  │ ───────────> │  PHP后端    │
│         │               │    (Workers)     │              │ (ThinkPHP)  │
└─────────┘  <──────────  └──────────────────┘  <─────────  └─────────────┘
              缓存响应           智能缓存                      原始数据
```

**关键点：**
- Worker不是独立系统，是PHP项目的加速层
- 所有逻辑仍在PHP后端运行
- Worker只负责请求转发和缓存

---

## 费用说明

**Cloudflare Workers 免费套餐：**
- 每天 100,000 次请求
- 每次请求 10ms CPU时间
- 对大多数个人和小型项目足够

超出限制：$5/月，包含1000万请求

详见 [Cloudflare Workers定价](https://developers.cloudflare.com/workers/platform/pricing/)

---

## 技术支持

- **GitHub Issues**: [提交问题](https://github.com/longzheng268/dnsmanager/issues)
- **原项目**: [netcccyun/dnsmgr](https://github.com/netcccyun/dnsmgr)
- **Cloudflare文档**: [Workers Documentation](https://developers.cloudflare.com/workers/)

---

## 许可证

本项目遵循 Apache-2.0 License

Workers集成部分由 longzheng268 开发，作为DNS Manager项目的部署选项提供。
