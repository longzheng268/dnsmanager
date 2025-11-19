/**
 * DNS Manager - Cloudflare Workers 边缘加速
 * 
 * 原项目: 彩虹聚合DNS管理系统
 * Copyright (c) 2024 消失的彩虹海 (https://blog.cccyun.cn)
 * Licensed under Apache-2.0 License
 * 
 * Cloudflare Workers 边缘加速集成
 * Copyright (c) 2024 longzheng268 (https://www.lz-0315.com)
 * 
 * 本Worker为DNS Manager PHP项目提供全球边缘加速服务
 * 
 * 功能：
 * - 请求转发：将所有请求代理到PHP后端
 * - 智能缓存：缓存GET请求到全球边缘节点
 * - CORS处理：自动处理跨域请求
 * - IP转发：保留真实客户端IP
 * 
 * 注意：Worker不运行PHP代码，所有业务逻辑在后端PHP项目中处理
 */

export interface Env {
  // Backend URL where your PHP DNS Manager is hosted
  BACKEND_URL?: string;
  
  // Optional: API key for authentication
  API_KEY?: string;
  
  // Optional: KV namespace for caching
  DNS_CACHE?: KVNamespace;
  
  // Optional: D1 database
  DNS_DB?: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/worker/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'dnsmanager-worker',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Worker info endpoint
    if (url.pathname === '/worker/info') {
      return new Response(JSON.stringify({
        name: 'DNS Manager Worker',
        version: '1.0.0',
        description: 'Cloudflare Workers proxy for DNS Manager',
        backend_configured: !!env.BACKEND_URL,
        features: {
          caching: !!env.DNS_CACHE,
          database: !!env.DNS_DB
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // If backend URL is not configured, return setup instructions page
    if (!env.BACKEND_URL) {
      return getSetupGuidePage();
    }

    // Handle root path - show welcome page or proxy to backend
    if (url.pathname === '/') {
      return getWelcomePage(env);
    }

    // Proxy all other requests to backend
    return handleProxy(request, env);
  }
};

/**
 * Proxy requests to the backend DNS Manager
 */
async function handleProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Build backend URL
  const backendUrl = new URL(url.pathname + url.search, env.BACKEND_URL);
  
  // Clone the request headers
  const headers = new Headers(request.headers);
  
  // Add custom headers if needed
  if (env.API_KEY) {
    headers.set('X-Worker-API-Key', env.API_KEY);
  }
  
  // Add Cloudflare specific headers
  headers.set('X-Forwarded-By', 'cloudflare-worker');
  headers.set('X-Real-IP', request.headers.get('cf-connecting-ip') || '');
  
  // Create the proxied request
  const proxiedRequest = new Request(backendUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
  });

  try {
    // Check cache for GET requests
    const cacheKey = new Request(backendUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    
    if (request.method === 'GET') {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Fetch from backend
    const response = await fetch(proxiedRequest);
    
    // Clone response for caching
    const clonedResponse = response.clone();
    
    // Cache successful GET requests
    if (request.method === 'GET' && response.ok) {
      // Add cache headers
      const cacheResponse = new Response(clonedResponse.body, clonedResponse);
      cacheResponse.headers.set('Cache-Control', 'public, max-age=300');
      
      // Store in cache (don't await)
      cache.put(cacheKey, cacheResponse);
    }
    
    // Add CORS headers if needed
    const corsResponse = addCorsHeaders(response);
    
    return corsResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(JSON.stringify({
      error: 'Backend connection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      backend: env.BACKEND_URL
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Generate setup guide page (when BACKEND_URL is not configured)
 */
function getSetupGuidePage(): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DNS Manager Worker - 配置向导 Setup Guide</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .status {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px 20px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .status h2 {
      color: #856404;
      font-size: 18px;
      margin-bottom: 8px;
    }
    .status p {
      color: #856404;
      font-size: 14px;
      line-height: 1.6;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h3 {
      font-size: 20px;
      color: #333;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
    }
    .section h3::before {
      content: '▸';
      color: #667eea;
      font-size: 24px;
      margin-right: 10px;
    }
    .steps {
      list-style: none;
    }
    .step {
      background: #f8f9fa;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .step-number {
      display: inline-block;
      background: #667eea;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      text-align: center;
      line-height: 28px;
      font-weight: bold;
      margin-right: 10px;
      font-size: 14px;
    }
    .step h4 {
      display: inline-block;
      color: #333;
      font-size: 16px;
      margin-bottom: 10px;
    }
    .step p {
      color: #666;
      line-height: 1.6;
      margin-top: 10px;
      font-size: 14px;
    }
    .code-block {
      background: #282c34;
      color: #abb2bf;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .code-block code {
      color: #98c379;
    }
    .links {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .link-button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
    }
    .link-button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .link-button.secondary {
      background: #6c757d;
    }
    .link-button.secondary:hover {
      background: #5a6268;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      color: #666;
      font-size: 13px;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .lang-toggle {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 DNS Manager 边缘加速</h1>
      <p>为您的PHP项目启用全球加速 / Global Edge Acceleration for Your PHP Project</p>
    </div>
    
    <div class="content">
      <div class="status">
        <h2>⚠️ 需要配置PHP后端地址 / Backend Configuration Required</h2>
        <p>Workers边缘加速已部署，但需要配置您的PHP项目后端地址才能使用。<br>
        The edge acceleration is deployed, but requires your PHP backend URL configuration to function.</p>
      </div>

      <div class="section">
        <h3>中文配置指南</h3>
        <ol class="steps">
          <li class="step">
            <span class="step-number">1</span>
            <h4>部署PHP项目</h4>
            <p>首先，将DNS Manager PHP项目部署到服务器（VPS、云服务器、宝塔面板等）。</p>
            <p>确保PHP项目可以通过URL访问，例如：<code>https://dns.example.com</code></p>
          </li>
          <li class="step">
            <span class="step-number">2</span>
            <h4>配置后端地址</h4>
            <p>在项目根目录找到 <code>wrangler.jsonc</code> 文件，修改配置：</p>
            <div class="code-block">
{<br>
  "vars": {<br>
    <code>"BACKEND_URL": "https://dns.example.com"</code>  // 改为您的实际地址<br>
  }<br>
}
            </div>
          </li>
          <li class="step">
            <span class="step-number">3</span>
            <h4>重新部署Workers</h4>
            <p>在项目根目录运行：</p>
            <div class="code-block">npm run deploy</div>
            <p>部署完成后，全球用户将通过Cloudflare边缘节点快速访问您的DNS Manager。</p>
          </li>
        </ol>
      </div>

      <div class="section lang-toggle">
        <h3>English Setup Guide</h3>
        <ol class="steps">
          <li class="step">
            <span class="step-number">1</span>
            <h4>Deploy PHP Project</h4>
            <p>First, deploy the DNS Manager PHP project to your server (VPS, cloud server, control panel, etc.).</p>
            <p>Ensure the PHP project is accessible via URL, e.g., <code>https://dns.example.com</code></p>
          </li>
          <li class="step">
            <span class="step-number">2</span>
            <h4>Configure Backend URL</h4>
            <p>Find <code>wrangler.jsonc</code> in the project root and modify:</p>
            <div class="code-block">
{<br>
  "vars": {<br>
    <code>"BACKEND_URL": "https://dns.example.com"</code>  // Change to your actual URL<br>
  }<br>
}
            </div>
          </li>
          <li class="step">
            <span class="step-number">3</span>
            <h4>Redeploy Workers</h4>
            <p>Run in the project root:</p>
            <div class="code-block">npm run deploy</div>
            <p>After deployment, global users will access your DNS Manager through Cloudflare edge nodes.</p>
          </li>
        </ol>
      </div>

      <div class="links">
        <a href="https://github.com/longzheng268/dnsmanager/blob/main/CLOUDFLARE_DEPLOY.md" class="link-button" target="_blank">📖 完整部署文档 / Full Documentation</a>
        <a href="https://github.com/longzheng268/dnsmanager" class="link-button secondary" target="_blank">💻 GitHub Repository</a>
      </div>
    </div>

    <div class="footer">
      <p>PHP项目原作者 Original Author: <a href="https://blog.cccyun.cn" target="_blank">消失的彩虹海</a></p>
      <p>边缘加速集成 Edge Acceleration: <a href="https://www.lz-0315.com" target="_blank">longzheng268</a></p>
      <p style="margin-top: 10px;">Powered by Cloudflare Workers ⚡</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Generate welcome page (when BACKEND_URL is configured and accessing root)
 */
function getWelcomePage(env: Env): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DNS Manager Worker - 运行中 Running</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .status {
      background: #d1fae5;
      border-left: 4px solid #10b981;
      padding: 15px 20px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .status h2 {
      color: #065f46;
      font-size: 18px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    .status h2::before {
      content: '✓';
      display: inline-block;
      width: 24px;
      height: 24px;
      background: #10b981;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      margin-right: 10px;
      font-weight: bold;
    }
    .status p {
      color: #065f46;
      font-size: 14px;
      line-height: 1.6;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .info-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .info-card h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-card p {
      font-size: 16px;
      color: #333;
      font-weight: 500;
      word-break: break-all;
    }
    .section {
      margin: 30px 0;
    }
    .section h3 {
      font-size: 20px;
      color: #333;
      margin-bottom: 15px;
    }
    .feature-list {
      list-style: none;
    }
    .feature-list li {
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
    }
    .feature-list li:last-child {
      border-bottom: none;
    }
    .feature-list li::before {
      content: '→';
      color: #667eea;
      font-weight: bold;
      margin-right: 10px;
      font-size: 18px;
    }
    .links {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .link-button {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
    }
    .link-button:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      color: #666;
      font-size: 13px;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ DNS Manager 边缘加速已启用</h1>
      <p>您的PHP项目已连接全球加速网络 / Your PHP Project is Connected to Global Edge Network</p>
    </div>
    
    <div class="content">
      <div class="status">
        <h2>边缘加速正常运行</h2>
        <p>您的 DNS Manager 已启用 Cloudflare 边缘加速。全球用户将通过就近的边缘节点访问您的系统。<br>
        Your DNS Manager is accelerated by Cloudflare edge network. Global users will access through nearby edge nodes.</p>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <h3>加速状态 / Status</h3>
          <p>🟢 运行中 / Active</p>
        </div>
        <div class="info-card">
          <h3>PHP后端 / Backend</h3>
          <p>${env.BACKEND_URL}</p>
        </div>
        <div class="info-card">
          <h3>边缘节点 / Edge Nodes</h3>
          <p>🌍 全球200+ / 200+ Worldwide</p>
        </div>
        <div class="info-card">
          <h3>缓存 / Caching</h3>
          <p>${env.DNS_CACHE ? '✓ 已启用 / Enabled' : '○ 基础 / Basic'}</p>
        </div>
      </div>

      <div class="section">
        <h3>✨ 加速特性 / Edge Features</h3>
        <ul class="feature-list">
          <li>智能请求路由到PHP后端 / Smart routing to PHP backend</li>
          <li>GET请求边缘缓存 / Edge caching for GET requests</li>
          <li>自动CORS跨域处理 / Automatic CORS handling</li>
          <li>真实IP地址转发 / Real IP forwarding</li>
          <li>全球低延迟访问 / Global low-latency access</li>
        </ul>
      </div>

      <div class="section">
        <h3>📚 使用说明 / How to Use</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
          现在直接访问此Workers域名即可使用DNS Manager系统，所有请求会自动转发到PHP后端。<br>
          Simply access this Workers domain to use DNS Manager. All requests are automatically forwarded to the PHP backend.
        </p>
        <div class="links">
          <a href="${env.BACKEND_URL}" class="link-button" target="_blank">🌐 访问PHP后端 / Visit PHP Backend</a>
          <a href="/health" class="link-button" target="_blank">🔍 健康检查 / Health Check</a>
          <a href="https://github.com/longzheng268/dnsmanager" class="link-button" target="_blank">💻 GitHub</a>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>PHP项目原作者 Original Author: <a href="https://blog.cccyun.cn" target="_blank">消失的彩虹海</a></p>
      <p>边缘加速集成 Edge Acceleration: <a href="https://www.lz-0315.com" target="_blank">longzheng268</a></p>
      <p style="margin-top: 10px;">Powered by Cloudflare Workers ⚡</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Add CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}
