# DNS Manager Cloudflare Workers Deployment

## One-Click Deploy to Cloudflare Workers

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/longzheng268/dnsmanager)

## Manual Deployment Steps

### Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Node.js](https://nodejs.org/) v18+ installed
3. Your DNS Manager backend deployed and accessible

### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

Or use with npx:

```bash
npx wrangler --version
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 3: Clone and Configure

```bash
# Navigate to worker directory
cd worker

# Install dependencies
npm install

# Edit wrangler.toml and set your BACKEND_URL
nano wrangler.toml
```

Update the `BACKEND_URL` variable:

```toml
[vars]
BACKEND_URL = "https://your-dnsmanager-backend.com"
```

### Step 4: Deploy

```bash
# Deploy to Cloudflare
npm run deploy

# Or use wrangler directly
wrangler deploy
```

### Step 5: Test Your Deployment

```bash
# Your worker will be available at:
# https://dnsmanager-worker.YOUR_SUBDOMAIN.workers.dev

# Test the health endpoint
curl https://dnsmanager-worker.YOUR_SUBDOMAIN.workers.dev/health
```

## Configuration Options

### Environment Variables

Set in `wrangler.toml` under `[vars]`:

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_URL` | Yes | Your DNS Manager backend URL |
| `API_KEY` | No | Optional API key for authentication |

### Custom Domain

To use a custom domain:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages
3. Select your worker
4. Click "Triggers" tab
5. Add a custom domain

### Secrets

For sensitive data (like API keys), use secrets instead of vars:

```bash
# Set a secret
wrangler secret put API_KEY

# List secrets
wrangler secret list

# Delete a secret
wrangler secret delete API_KEY
```

## GitHub Actions Deployment

This repository includes automated deployment via GitHub Actions.

### Setup

1. Get your Cloudflare API Token:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Create Token -> Use "Edit Cloudflare Workers" template
   - Copy the token

2. Add to GitHub Secrets:
   - Go to your repository Settings -> Secrets and variables -> Actions
   - Add new secret: `CLOUDFLARE_API_TOKEN`
   - Paste your API token

3. Push changes to trigger deployment:
   ```bash
   git push origin main
   ```

The worker will automatically deploy on every push to the `main` branch that modifies files in the `worker/` directory.

## Updating Your Worker

To update your deployed worker:

```bash
cd worker
npm run deploy
```

Or push changes to GitHub if you've set up GitHub Actions.

## Monitoring

### View Logs

Stream real-time logs:

```bash
cd worker
npm run tail
```

### Analytics

View analytics in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. Check the "Metrics" tab

## Troubleshooting

### "Backend URL not configured"

Make sure `BACKEND_URL` is set in `wrangler.toml`:

```toml
[vars]
BACKEND_URL = "https://your-backend.com"
```

### "Authentication failed"

Run `wrangler login` again to re-authenticate.

### Worker not updating

Try:
```bash
wrangler deploy --force
```

### Need Help?

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Issues](https://github.com/longzheng268/dnsmanager/issues)

## Cost

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

For higher usage, check [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/).
