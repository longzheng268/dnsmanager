# Workers 源代码目录

这个目录包含了为DNS Manager提供边缘加速的Cloudflare Workers代码。

**注意：** Worker不是独立项目，是DNS Manager PHP项目的一个部署选项。

## 快速使用

在项目根目录运行：

```bash
# 安装依赖
npm install

# 配置后端地址（编辑根目录的 wrangler.jsonc）
# 修改 BACKEND_URL 为您的PHP后端地址

# 部署
npm run deploy
```

## 完整文档

详细配置和使用说明请查看项目根目录的 [CLOUDFLARE_DEPLOY.md](../CLOUDFLARE_DEPLOY.md)

## 目录结构

```
worker/
├── src/
│   └── index.ts          # Workers入口文件（请求转发和缓存）
├── package.json          # Workers依赖（已整合到根目录）
├── tsconfig.json         # TypeScript配置
└── wrangler.toml         # Workers配置（备用，优先使用根目录wrangler.jsonc）
```

## 技术说明

Worker的作用：
1. **请求转发** - 将所有请求转发到PHP后端
2. **智能缓存** - 缓存GET请求响应到边缘节点
3. **CORS处理** - 自动处理跨域请求
4. **IP转发** - 保留真实客户端IP

**不做的事：**
- ❌ 不运行PHP代码（由后端处理）
- ❌ 不独立存储数据（使用后端数据库）
- ❌ 不替代后端（只是加速层）

---

**原作者**: 消失的彩虹海 - [彩虹聚合DNS管理系统](https://blog.cccyun.cn)  
**Workers集成**: longzheng268 - [个人主页](https://www.lz-0315.com)
