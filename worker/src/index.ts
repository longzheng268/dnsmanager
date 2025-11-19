/**
 * DNS Manager - Cloudflare Worker
 * 
 * Original work: 彩虹聚合DNS管理系统
 * Copyright (c) 2024 消失的彩虹海 (https://blog.cccyun.cn)
 * Licensed under MIT License
 * 
 * Cloudflare Worker Adapter (Derivative Work)
 * Copyright (c) 2024 longzheng268 (https://www.lz-0315.com)
 * 
 * This adapter provides edge computing capabilities for the DNS Manager system.
 * 
 * This worker acts as an API gateway and edge proxy for the DNS Manager system.
 * It provides:
 * - API request routing and proxying
 * - Edge caching for improved performance
 * - Rate limiting and security
 * - CORS handling
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
      <h1>🚀 DNS Manager Worker</h1>
      <p>Cloudflare Workers Edge Computing</p>
    </div>
    
    <div class="content">
      <div class="status">
        <h2>⚠️ 配置需要完成 / Configuration Required</h2>
        <p>Worker 已成功部署，但需要配置后端地址才能正常使用。<br>
        The worker is successfully deployed, but requires backend URL configuration to function properly.</p>
      </div>

      <div class="section">
        <h3>中文配置指南</h3>
        <ol class="steps">
          <li class="step">
            <span class="step-number">1</span>
            <h4>编辑配置文件</h4>
            <p>在您的项目中找到 <code>wrangler.toml</code> 文件，添加或修改以下内容：</p>
            <div class="code-block">[vars]<br><code>BACKEND_URL = "https://your-dnsmanager.example.com"</code></div>
            <p>将 URL 替换为您的 DNS Manager 后端实际地址。</p>
          </li>
          <li class="step">
            <span class="step-number">2</span>
            <h4>重新部署 Worker</h4>
            <p>在项目目录中运行以下命令：</p>
            <div class="code-block">cd worker<br>npm run deploy</div>
            <p>或者使用 wrangler 命令：</p>
            <div class="code-block">npx wrangler deploy</div>
          </li>
          <li class="step">
            <span class="step-number">3</span>
            <h4>验证配置</h4>
            <p>部署完成后，刷新此页面，如果配置正确，您将看到欢迎页面。</p>
          </li>
        </ol>
      </div>

      <div class="section lang-toggle">
        <h3>English Setup Guide</h3>
        <ol class="steps">
          <li class="step">
            <span class="step-number">1</span>
            <h4>Edit Configuration File</h4>
            <p>Locate the <code>wrangler.toml</code> file in your project and add or modify:</p>
            <div class="code-block">[vars]<br><code>BACKEND_URL = "https://your-dnsmanager.example.com"</code></div>
            <p>Replace the URL with your actual DNS Manager backend address.</p>
          </li>
          <li class="step">
            <span class="step-number">2</span>
            <h4>Redeploy the Worker</h4>
            <p>Run the following command in your project directory:</p>
            <div class="code-block">cd worker<br>npm run deploy</div>
            <p>Or use wrangler directly:</p>
            <div class="code-block">npx wrangler deploy</div>
          </li>
          <li class="step">
            <span class="step-number">3</span>
            <h4>Verify Configuration</h4>
            <p>After deployment, refresh this page. If configured correctly, you'll see the welcome page.</p>
          </li>
        </ol>
      </div>

      <div class="links">
        <a href="https://github.com/longzheng268/dnsmanager/blob/main/CLOUDFLARE_DEPLOY.md" class="link-button" target="_blank">📖 完整部署文档 / Full Documentation</a>
        <a href="https://github.com/longzheng268/dnsmanager" class="link-button secondary" target="_blank">💻 GitHub Repository</a>
      </div>
    </div>

    <div class="footer">
      <p>原作者 Original Author: <a href="https://blog.cccyun.cn" target="_blank">消失的彩虹海</a></p>
      <p>Worker 适配 Worker Adapter: <a href="https://www.lz-0315.com" target="_blank">longzheng268</a></p>
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
      <h1>✨ DNS Manager Worker</h1>
      <p>边缘计算已就绪 / Edge Computing Ready</p>
    </div>
    
    <div class="content">
      <div class="status">
        <h2>Worker 正在运行中</h2>
        <p>您的 DNS Manager Worker 已成功配置并正在运行。所有 API 请求将被代理到后端服务器。<br>
        Your DNS Manager Worker is successfully configured and running. All API requests will be proxied to the backend server.</p>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <h3>Worker 版本 / Version</h3>
          <p>1.0.0</p>
        </div>
        <div class="info-card">
          <h3>后端地址 / Backend URL</h3>
          <p>${env.BACKEND_URL}</p>
        </div>
        <div class="info-card">
          <h3>状态 / Status</h3>
          <p>🟢 运行中 / Running</p>
        </div>
        <div class="info-card">
          <h3>功能 / Features</h3>
          <p>缓存${env.DNS_CACHE ? '✓' : '✗'} | 数据库${env.DNS_DB ? '✓' : '✗'}</p>
        </div>
      </div>

      <div class="section">
        <h3>✨ 功能特性 / Features</h3>
        <ul class="feature-list">
          <li>API 请求智能路由和代理 / Intelligent API routing and proxying</li>
          <li>边缘缓存提升性能 / Edge caching for improved performance</li>
          <li>自动 CORS 处理 / Automatic CORS handling</li>
          <li>全球边缘节点加速 / Global edge node acceleration</li>
          <li>请求头转发和处理 / Request header forwarding and processing</li>
        </ul>
      </div>

      <div class="section">
        <h3>📚 快速开始 / Quick Start</h3>
        <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
          要使用 DNS Manager 系统，请访问后端地址或使用 API 端点。此 Worker 会自动将请求代理到后端服务器。<br>
          To use the DNS Manager system, visit the backend URL or use API endpoints. This worker automatically proxies requests to the backend server.
        </p>
        <div class="links">
          <a href="${env.BACKEND_URL}" class="link-button" target="_blank">🌐 访问后端 / Visit Backend</a>
          <a href="/health" class="link-button" target="_blank">🔍 健康检查 / Health Check</a>
          <a href="https://github.com/longzheng268/dnsmanager" class="link-button" target="_blank">💻 GitHub</a>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>原作者 Original Author: <a href="https://blog.cccyun.cn" target="_blank">消失的彩虹海</a></p>
      <p>Worker 适配 Worker Adapter: <a href="https://www.lz-0315.com" target="_blank">longzheng268</a></p>
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
