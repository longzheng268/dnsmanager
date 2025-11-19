# Cloudflare Workers 快速部署指南

**原作者**: 消失的彩虹海 - [彩虹聚合DNS管理系统](https://blog.cccyun.cn)  
**Worker 适配**: longzheng268 - [www.lz-0315.com](https://www.lz-0315.com)

---

## 一键部署到 Cloudflare Workers

### 方法一：使用 Wrangler CLI（推荐）

这是最简单直接的部署方式，只需要几个命令：

#### 第一步：安装依赖

```bash
# 进入 worker 目录
cd worker

# 安装依赖
npm install
```

#### 第二步：登录 Cloudflare

```bash
# 首次使用需要登录
npx wrangler login
```

这会打开浏览器窗口，登录你的 Cloudflare 账号。

#### 第三步：配置后端地址

编辑 `wrangler.toml` 文件：

```toml
[vars]
BACKEND_URL = "https://your-dnsmanager.example.com"
```

将 `https://your-dnsmanager.example.com` 替换为你的 DNS Manager 后端地址。

#### 第四步：部署

```bash
# 部署到 Cloudflare Workers
npm run deploy
```

或者直接使用 wrangler：

```bash
npx wrangler deploy
```

部署成功后，你会看到类似这样的输出：

```
Total Upload: 4.21 KiB / gzip: 1.46 KiB
Uploaded dnsmanager-worker (1.23 sec)
Published dnsmanager-worker (0.45 sec)
  https://dnsmanager-worker.YOUR_SUBDOMAIN.workers.dev
```

#### 第五步：测试

```bash
# 测试健康检查
curl https://dnsmanager-worker.YOUR_SUBDOMAIN.workers.dev/health

# 应该返回：
# {"status":"ok","worker":"dnsmanager-worker","version":"1.0.0",...}
```

---

### 方法二：GitHub Actions 自动部署

#### 配置步骤：

1. **获取 Cloudflare API Token**
   - 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - 点击 "Create Token"
   - 选择 "Edit Cloudflare Workers" 模板
   - 复制生成的 Token

2. **添加到 GitHub Secrets**
   - 进入你的仓库 Settings → Secrets and variables → Actions
   - 点击 "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: 粘贴你的 API Token
   - 点击 "Add secret"

3. **推送代码触发部署**
   ```bash
   git push origin main
   ```

每次推送到 `main` 分支且修改了 `worker/` 目录下的文件时，GitHub Actions 会自动部署。

---

### 方法三：Cloudflare Dashboard 手动部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 "Workers & Pages"
3. 点击 "Create Application" → "Create Worker"
4. 复制 `worker/src/index.ts` 的内容粘贴到编辑器
5. 点击 "Save and Deploy"
6. 在 Settings → Variables 中添加环境变量：
   - Variable name: `BACKEND_URL`
   - Value: 你的后端地址

---

## 配置选项

### 必需配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `BACKEND_URL` | DNS Manager 后端地址 | `https://dns.example.com` |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `API_KEY` | API 认证密钥 | 无 |

### 使用 Secrets（敏感信息）

对于敏感信息如 API 密钥，使用 secrets 而不是 vars：

```bash
# 设置 secret
npx wrangler secret put API_KEY

# 会提示输入值，输入后按回车

# 列出所有 secrets
npx wrangler secret list

# 删除 secret
npx wrangler secret delete API_KEY
```

---

## 绑定自定义域名

部署后，你的 Worker 会有一个 `.workers.dev` 域名。如需使用自定义域名：

### 方法一：通过 Dashboard

1. 进入 Cloudflare Dashboard
2. Workers & Pages → 选择你的 Worker
3. 点击 "Triggers" 标签
4. 在 "Custom Domains" 部分点击 "Add Custom Domain"
5. 输入域名（如 `api.yourdomain.com`）
6. 点击 "Add Custom Domain"

### 方法二：通过 Wrangler

在 `wrangler.toml` 中添加：

```toml
routes = [
  { pattern = "api.yourdomain.com/*", custom_domain = true }
]
```

然后重新部署：

```bash
npm run deploy
```

---

## 高级配置

### KV 存储（缓存加速）

创建 KV namespace：

```bash
npx wrangler kv:namespace create "DNS_CACHE"
```

记下返回的 `id`，添加到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "DNS_CACHE"
id = "你的-kv-namespace-id"
```

### D1 数据库（边缘数据库）

创建 D1 数据库：

```bash
npx wrangler d1 create dnsmanager
```

添加到 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DNS_DB"
database_name = "dnsmanager"
database_id = "你的-database-id"
```

---

## 监控和日志

### 实时日志

```bash
cd worker
npm run tail

# 或使用 wrangler
npx wrangler tail
```

### 查看指标

在 Cloudflare Dashboard 的 Worker 页面中：
- Metrics 标签：查看请求量、错误率、CPU 时间
- Analytics 标签：详细的分析数据

---

## 更新 Worker

修改代码后，重新部署即可：

```bash
cd worker
npm run deploy
```

Worker 会立即更新到最新版本。

---

## 故障排查

### 问题：Backend URL not configured

**解决方案**：确保在 `wrangler.toml` 中设置了 `BACKEND_URL`：

```toml
[vars]
BACKEND_URL = "https://your-backend.com"
```

### 问题：Authentication failed

**解决方案**：重新登录 Cloudflare：

```bash
npx wrangler login
```

### 问题：Worker 没有更新

**解决方案**：强制部署：

```bash
npx wrangler deploy --force
```

### 问题：CORS 错误

Worker 已内置 CORS 支持。如果仍有问题，检查后端的 CORS 配置。

---

## 成本说明

Cloudflare Workers **免费套餐**包含：

- ✅ 每天 100,000 个请求
- ✅ 每个请求 10ms CPU 时间
- ✅ 无限带宽

对于大多数个人和小型项目来说，免费套餐已经足够。

**付费套餐** ($5/月)：
- 1000万请求/月（额外请求 $0.50/百万）
- 每个请求 50ms CPU 时间
- 更多功能

详见：[Cloudflare Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)

---

## 支持

遇到问题？

- 📖 查看 [Worker README](./worker/README.md)
- 🐛 提交 [GitHub Issue](https://github.com/longzheng268/dnsmanager/issues)
- 📚 阅读 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- 🌐 原作者博客：https://blog.cccyun.cn
- 🌐 Worker 适配作者：https://www.lz-0315.com

---

## 许可证

MIT License

- **原作品**: Copyright (c) 2024 消失的彩虹海
- **Worker 适配**: Copyright (c) 2024 longzheng268

本项目遵循 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。
