# Backend Deployment Guide

This guide covers deploying the backend API server to various platforms.

## Prerequisites

⚠️ **Important**: The backend requires access to the `@kontent-ai/data-ops` CLI tool. The current setup uses local file dependencies which need special handling.

### Option 1: Publish Dependencies (Recommended)

Publish `data-ops` and `custom-app-sdk-js` as npm packages, or:

### Option 2: Use Git Submodules

Use git submodules to include the dependencies in deployment.

### Option 3: Install from GitHub

Modify deployment to install dependencies directly from GitHub repositories.

## Platform-Specific Deployment

### Railway (Recommended)

Railway is excellent for Node.js apps with long-running processes.

#### Steps:

1. **Install Railway CLI** (optional):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Initialize Project**:
   ```bash
   railway init
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

#### Via Railway Dashboard:

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the configuration
6. Set environment variables (see below)
7. Deploy!

#### Environment Variables:

- `NODE_ENV=production`
- `PORT` (auto-set by Railway)
- `CORS_ORIGIN` - Comma-separated list of allowed origins (e.g., `https://your-frontend.netlify.app,https://your-domain.com`)
- `DATA_OPS_CLI_PATH` - Path to data-ops CLI (if not in PATH)

#### Custom Domain:

1. Go to project settings
2. Click "Generate Domain" or add custom domain
3. Update `CORS_ORIGIN` to include your domain

---

### Render

Render offers a free tier with good Node.js support.

#### Steps:

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `data-ops-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:ts`
   - **Start Command**: `node build/server/index.js`
   - **Plan**: Starter (free) or higher

#### Environment Variables:

Add in Render dashboard:
- `NODE_ENV=production`
- `CORS_ORIGIN` - Your frontend URL(s)
- `DATA_OPS_CLI_PATH` - If needed

#### Custom Domain:

1. Go to service settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records

---

### Fly.io

Fly.io is great for containerized apps with global distribution.

#### Steps:

1. **Install Fly CLI**:
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Launch App**:
   ```bash
   fly launch
   ```
   - Follow prompts to configure
   - Select region
   - Don't deploy yet (we need to configure first)

4. **Set Secrets**:
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set CORS_ORIGIN=https://your-frontend.netlify.app
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

#### Custom Domain:

```bash
fly domains add your-domain.com
```

---

### Docker Deployment

For any Docker-compatible platform (AWS, GCP, Azure, DigitalOcean, etc.)

#### Build Image:

```bash
docker build -t data-ops-backend .
```

#### Run Container:

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=https://your-frontend.netlify.app \
  data-ops-backend
```

#### Push to Registry:

```bash
# Tag for your registry
docker tag data-ops-backend your-registry/data-ops-backend:latest

# Push
docker push your-registry/data-ops-backend:latest
```

---

## Handling Local Dependencies

The project uses local file dependencies:
- `@kontent-ai/data-ops` (file:./data-ops)
- `@kontent-ai/custom-app-sdk` (file:./custom-app-sdk-js)

### Solution 1: Publish to npm (Best)

1. Publish both packages to npm (public or private)
2. Update `package.json` to use published versions
3. Deploy normally

### Solution 2: Git Submodules

1. Convert to git submodules:
   ```bash
   git submodule add https://github.com/kontent-ai/data-ops.git data-ops
   git submodule add https://github.com/kontent-ai/custom-app-sdk-js.git custom-app-sdk-js
   ```

2. Update deployment to initialize submodules:
   ```bash
   git submodule update --init --recursive
   ```

### Solution 3: Install from GitHub

Modify `package.json`:
```json
{
  "dependencies": {
    "@kontent-ai/data-ops": "github:kontent-ai/data-ops",
    "@kontent-ai/custom-app-sdk": "github:kontent-ai/custom-app-sdk-js"
  }
}
```

### Solution 4: Copy Dependencies

Modify Dockerfile or build script to copy dependencies before `npm install`.

---

## Environment Variables

### Required:

- `NODE_ENV` - Set to `production`

### Optional:

- `PORT` - Server port (usually auto-set by platform)
- `CORS_ORIGIN` - Comma-separated allowed origins for CORS
- `DATA_OPS_CLI_PATH` - Path to data-ops CLI executable

### Example:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-app.netlify.app,https://your-domain.com
```

---

## Health Check

The server exposes a health check endpoint:

```
GET /health
```

Returns: `{ status: 'ok' }`

Configure this in your platform's health check settings.

---

## Testing Deployment

1. **Check Health**:
   ```bash
   curl https://your-backend-url.com/health
   ```

2. **Test API**:
   ```bash
   curl https://your-backend-url.com/api/commands
   ```

3. **Check Logs**:
   - Railway: `railway logs`
   - Render: Dashboard → Logs
   - Fly.io: `fly logs`

---

## Troubleshooting

### Build Fails

- Check Node.js version (requires 18+)
- Verify all dependencies are available
- Check build logs for specific errors

### API Returns 404

- Verify server is running
- Check route paths match
- Verify CORS is configured correctly

### CORS Errors

- Add your frontend URL to `CORS_ORIGIN`
- Use comma-separated list for multiple origins
- Include protocol (https://)

### CLI Commands Fail

- Verify `data-ops` CLI is accessible
- Check `DATA_OPS_CLI_PATH` environment variable
- Ensure CLI is installed in the deployment environment

---

## Updating Frontend

After deploying the backend:

1. Get your backend URL (e.g., `https://your-backend.railway.app`)
2. Update frontend environment variable:
   - In Netlify: `REACT_APP_API_URL=https://your-backend.railway.app`
3. Update `frontend/app-frontend.js`:
   ```javascript
   serverUrl: process.env.REACT_APP_API_URL || window.location.origin
   ```
4. Redeploy frontend

---

## Cost Estimates

- **Railway**: Free tier: $5 credit/month, then pay-as-you-go
- **Render**: Free tier available, $7/month for starter plan
- **Fly.io**: Free tier: 3 shared VMs, then pay-as-you-go
- **Docker (AWS/GCP)**: Varies by usage

---

## Recommended Setup

For production:
1. **Backend**: Railway or Render (easy setup, good free tiers)
2. **Frontend**: Netlify (excellent for static sites)
3. **Domain**: Use custom domain for both
4. **Monitoring**: Use platform's built-in monitoring

