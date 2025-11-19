#!/bin/bash
# DNS Manager - Cloudflare 一键部署脚本
# 此脚本帮助您快速部署DNS Manager到Cloudflare环境

set -e

echo "================================"
echo "DNS Manager - Cloudflare部署向导"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要工具
echo "检查必要工具..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未安装 npm${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}错误: 未安装 npx${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 工具检查通过${NC}"
echo ""

# 说明
echo "================================"
echo "重要说明"
echo "================================"
echo ""
echo "由于PHP项目需要PHP运行环境和MySQL数据库，"
echo "您需要先将PHP项目部署到以下任一环境："
echo ""
echo "  1. VPS服务器（推荐）"
echo "  2. 云服务器（阿里云、腾讯云等）"
echo "  3. 虚拟主机（支持PHP 8.0+）"
echo "  4. Docker容器"
echo ""
echo "然后使用本脚本部署Cloudflare Workers边缘加速。"
echo ""
echo -e "${YELLOW}Cloudflare Workers将作为边缘加速层，提升全球访问速度。${NC}"
echo ""

read -p "是否继续? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消部署"
    exit 0
fi

echo ""
echo "================================"
echo "配置后端地址"
echo "================================"
echo ""

# 获取后端地址
read -p "请输入您的PHP后端地址 (例如: https://dns.example.com): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}错误: 后端地址不能为空${NC}"
    exit 1
fi

# 验证URL格式
if [[ ! $BACKEND_URL =~ ^https?:// ]]; then
    echo -e "${RED}错误: 后端地址必须以 http:// 或 https:// 开头${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ 后端地址: $BACKEND_URL${NC}"
echo ""

# 更新配置文件
echo "更新配置文件..."

# 备份原配置
cp wrangler.jsonc wrangler.jsonc.backup

# 更新wrangler.jsonc
cat > wrangler.jsonc << EOF
{
  // DNS Manager - Cloudflare Workers 边缘加速配置
  "name": "dnsmanager",
  "main": "worker/src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  
  "vars": {
    "BACKEND_URL": "$BACKEND_URL"
  }
}
EOF

echo -e "${GREEN}✓ 配置文件已更新${NC}"
echo ""

# 安装依赖
echo "安装依赖..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "依赖已安装，跳过"
fi
echo ""

# 登录Cloudflare
echo "================================"
echo "登录Cloudflare"
echo "================================"
echo ""
echo "接下来将打开浏览器登录Cloudflare账号..."
read -p "按Enter继续..." 

npx wrangler login

echo ""
echo "================================"
echo "开始部署"
echo "================================"
echo ""

# 部署
npm run deploy

echo ""
echo "================================"
echo "部署完成！"
echo "================================"
echo ""
echo -e "${GREEN}✓ DNS Manager边缘加速已成功部署！${NC}"
echo ""
echo "您的Worker地址将显示在上面的输出中"
echo ""
echo "接下来："
echo "  1. 访问Worker地址查看状态"
echo "  2. 可以绑定自定义域名"
echo "  3. 全球用户将通过边缘节点访问您的系统"
echo ""
echo "配置文件备份: wrangler.jsonc.backup"
echo ""
