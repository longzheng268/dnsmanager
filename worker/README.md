# DNS Manager - Cloudflare Worker

This directory contains the Cloudflare Worker adapter for the DNS Manager system.

## Features

- **API Gateway**: Routes requests to your DNS Manager backend
- **Edge Caching**: Caches responses at Cloudflare's edge for better performance
- **Global Distribution**: Deploy your DNS Manager API globally
- **Rate Limiting**: Built-in protection against abuse
- **CORS Support**: Enables cross-origin requests

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Quick Start

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Configure Wrangler

Edit `wrangler.toml` and set your backend URL:

```toml
[vars]
BACKEND_URL = "https://your-dnsmanager-domain.com"
```

### 3. Deploy with Wrangler

```bash
# Login to Cloudflare (first time only)
npx wrangler login

# Deploy the worker
npm run deploy
```

Or use the wrangler command directly:

```bash
npx wrangler deploy
```

## Development

### Local Development

Run the worker locally:

```bash
npm run dev
```

This will start a local server at `http://localhost:8787`

### View Logs

Stream real-time logs from your deployed worker:

```bash
npm run tail
```

## Configuration

### Environment Variables

Configure in `wrangler.toml`:

```toml
[vars]
BACKEND_URL = "https://your-backend.com"  # Required: Your DNS Manager backend
API_KEY = "your-secret-key"                # Optional: API authentication key
```

### KV Storage (Optional)

For advanced caching, add KV namespace:

```toml
[[kv_namespaces]]
binding = "DNS_CACHE"
id = "your-kv-namespace-id"
```

Create KV namespace:

```bash
npx wrangler kv:namespace create "DNS_CACHE"
```

### D1 Database (Optional)

For edge database support:

```toml
[[d1_databases]]
binding = "DNS_DB"
database_name = "dnsmanager"
database_id = "your-d1-database-id"
```

Create D1 database:

```bash
npx wrangler d1 create dnsmanager
```

## API Endpoints

### Health Check

```
GET /health
GET /worker/health
```

Returns worker health status.

### Worker Info

```
GET /worker/info
```

Returns worker configuration and features.

### Proxy Endpoints

All other requests are proxied to your configured `BACKEND_URL`.

## Deployment Options

### Option 1: Wrangler CLI (Recommended)

```bash
npx wrangler deploy
```

### Option 2: GitHub Actions

See `.github/workflows/deploy-worker.yml` for automated deployment on push.

### Option 3: Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Create a new Worker
4. Copy the contents of `src/index.ts`
5. Configure environment variables
6. Deploy

## Troubleshooting

### Backend Connection Failed

Make sure your `BACKEND_URL` is:
- Accessible from the internet
- Using HTTPS
- Properly configured CORS if needed

### Authentication Issues

If using `API_KEY`, ensure your backend accepts the `X-Worker-API-Key` header.

### Cache Not Working

Check that:
- Requests are GET methods
- Responses are successful (200-299 status codes)
- Cache-Control headers are properly set

## Support

For issues and questions:
- [GitHub Issues](https://github.com/longzheng268/dnsmanager/issues)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

Apache-2.0 - See LICENSE file in the root directory
