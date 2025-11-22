# Quick Backend Deployment Guide

## 🚀 Recommended: Railway (Easiest)

### Step 1: Deploy to Railway

1. **Go to [railway.app](https://railway.app)** and sign up/login
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect the configuration

### Step 2: Configure Environment Variables

In Railway dashboard, go to your service → Variables tab, add:

```
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.netlify.app
```

(Replace with your actual Netlify frontend URL)

### Step 3: Get Your Backend URL

1. Railway will assign a URL like: `https://your-app.railway.app`
2. Copy this URL - you'll need it for the frontend

### Step 4: Update Frontend

1. In Netlify dashboard → Site settings → Environment variables
2. Add: `REACT_APP_API_URL=https://your-app.railway.app`
3. Update `frontend/app-frontend.js`:
   ```javascript
   serverUrl: process.env.REACT_APP_API_URL || window.location.origin
   ```
4. Redeploy frontend

## ⚠️ Important: Handle Local Dependencies

The project uses local file dependencies that need special handling:

### Option A: Install from GitHub (Quick Fix)

Update `package.json` dependencies:
```json
{
  "dependencies": {
    "@kontent-ai/data-ops": "github:kontent-ai/data-ops",
    "@kontent-ai/custom-app-sdk": "github:kontent-ai/custom-app-sdk-js"
  }
}
```

### Option B: Use Git Submodules

1. Convert to submodules:
   ```bash
   git submodule add https://github.com/kontent-ai/data-ops.git data-ops
   git submodule add https://github.com/kontent-ai/custom-app-sdk-js.git custom-app-sdk-js
   ```

2. Update Railway build command:
   ```bash
   git submodule update --init --recursive && npm install && npm run build:ts
   ```

### Option C: Publish to npm (Best for Production)

Publish both packages to npm and use published versions.

## 🔧 Alternative Platforms

### Render.com

1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Use `render.yaml` configuration (already created)
5. Set environment variables
6. Deploy!

### Fly.io

1. Install Fly CLI: `iwr https://fly.io/install.ps1 -useb | iex`
2. Login: `fly auth login`
3. Launch: `fly launch`
4. Set secrets: `fly secrets set CORS_ORIGIN=https://your-frontend.netlify.app`
5. Deploy: `fly deploy`

## ✅ Verify Deployment

1. **Health Check**:
   ```bash
   curl https://your-backend-url.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Test API**:
   ```bash
   curl https://your-backend-url.com/api/commands
   ```
   Should return command definitions

3. **Check Logs**:
   - Railway: Dashboard → Logs
   - Render: Service → Logs
   - Fly.io: `fly logs`

## 🐛 Troubleshooting

### Build Fails
- Check that dependencies are accessible
- Verify Node.js version (18+)
- Check build logs for specific errors

### CORS Errors
- Ensure `CORS_ORIGIN` includes your frontend URL
- Include protocol (https://)
- No trailing slashes

### API Not Responding
- Check server logs
- Verify health endpoint works
- Check environment variables

## 📝 Next Steps

1. ✅ Deploy backend (Railway/Render/Fly.io)
2. ✅ Get backend URL
3. ✅ Update frontend with backend URL
4. ✅ Deploy frontend to Netlify
5. ✅ Test end-to-end

For detailed instructions, see [BACKEND_DEPLOYMENT.md](BACKEND_DEPLOYMENT.md)

