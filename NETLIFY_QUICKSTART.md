# Netlify Deployment Quick Start

## Prerequisites

- GitHub repository connected to Netlify
- Netlify account (free tier works for static sites)

## Deployment Steps

### 1. Connect Repository to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository
4. Netlify will auto-detect the `netlify.toml` configuration

### 2. Configure Build Settings

Netlify should automatically detect:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** 18 (from netlify.toml)

If not auto-detected, manually set:
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `18`

### 3. Set Environment Variables (Optional)

If you need to configure the API URL or other settings:

1. Go to Site settings → Environment variables
2. Add variables as needed:
   - `NODE_ENV=production` (for minified builds)
   - `REACT_APP_API_URL` (if backend is deployed separately)

### 4. Deploy

1. Click "Deploy site"
2. Netlify will:
   - Install dependencies
   - Run the build command
   - Deploy the `dist/` directory
3. Your site will be live at `https://your-site-name.netlify.app`

## Important Notes

### ⚠️ Backend API Required

The frontend requires a backend API server. The static files deployed to Netlify will try to connect to:
- Same origin (if backend is also on Netlify)
- Or the URL specified in environment variables

**You need to deploy the backend separately** because:
- Netlify Functions have 10-26 second timeout limits
- CLI commands may take longer
- Server-Sent Events (SSE) don't work well with Functions

### Backend Deployment Options

1. **Railway** (Recommended)
   - Free tier available
   - Supports long-running processes
   - Easy deployment from GitHub

2. **Render**
   - Free tier available
   - Good for Node.js apps
   - Background workers supported

3. **Fly.io**
   - Free tier available
   - Container-based deployment
   - Good for CLI-based apps

### Update Frontend to Point to Backend

After deploying the backend, update the frontend:

1. Get your backend URL (e.g., `https://your-backend.railway.app`)
2. In Netlify, add environment variable:
   - `REACT_APP_API_URL=https://your-backend.railway.app`
3. Update `frontend/app-frontend.js` to use the environment variable:
   ```javascript
   serverUrl: process.env.REACT_APP_API_URL || window.location.origin
   ```
4. Redeploy

## Testing the Deployment

1. Visit your Netlify URL
2. Check browser console for any errors
3. Test API connectivity
4. Verify all static assets load correctly

## Troubleshooting

### Build Fails
- Check Node.js version (must be 18+)
- Verify all dependencies are in `package.json`
- Check build logs in Netlify dashboard

### API Calls Fail
- Verify backend is deployed and accessible
- Check CORS settings on backend
- Verify API URL is correct in frontend

### 404 Errors on Refresh
- Ensure `_redirects` file is in `dist/` directory
- Check Netlify redirect rules in dashboard

## Continuous Deployment

Netlify automatically deploys when you push to:
- `main` branch → Production
- Other branches → Preview deployments

You can also trigger manual deploys from the dashboard.

## Custom Domain

1. Go to Site settings → Domain management
2. Add your custom domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

