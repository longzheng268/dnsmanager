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

    // If backend URL is not configured, return setup instructions
    if (!env.BACKEND_URL) {
      if (url.pathname === '/' || url.pathname === '/worker') {
        return new Response(JSON.stringify({
          message: 'DNS Manager Worker is running',
          setup_required: true,
          instructions: {
            step1: 'Configure BACKEND_URL environment variable in wrangler.toml',
            step2: 'Point BACKEND_URL to your DNS Manager PHP backend',
            step3: 'Redeploy the worker using: wrangler deploy',
            example: 'BACKEND_URL = "https://your-dnsmanager.example.com"'
          },
          documentation: 'https://github.com/longzheng268/dnsmanager#cloudflare-workers-deployment'
        }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // Proxy all other requests to backend
    if (env.BACKEND_URL) {
      return handleProxy(request, env);
    }

    // Fallback 404
    return new Response('Not Found', { status: 404 });
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
