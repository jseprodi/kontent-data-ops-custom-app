# Deployment Guide

This guide covers deploying the Kontent.ai Data-Ops Custom App to various platforms.

## Netlify Deployment

### Option 1: Static Frontend Only (Recommended for Kontent.ai Custom Apps)

The frontend can be deployed as a static site to Netlify. However, **the backend API server must be deployed separately** since it requires:
- Long-running processes for CLI command execution
- File system access
- Ability to execute child processes

**Steps:**
1. Connect your GitHub repository to Netlify
2. Netlify will automatically detect the `netlify.toml` configuration
3. The build will create static files in the `dist/` directory
4. Deploy the backend separately (see Backend Deployment below)

### Option 2: Netlify Functions (Limited Functionality)

The API endpoints can be converted to Netlify Functions, but with limitations:
- ⚠️ **10-second timeout** on free tier (26 seconds on paid)
- ⚠️ CLI commands may take longer than the timeout
- ⚠️ Limited file system access
- ⚠️ No persistent storage

**To convert to Netlify Functions:**
1. Create `netlify/functions/` directory
2. Convert Express routes to serverless functions
3. Handle streaming responses differently (Functions don't support SSE well)
4. Consider using Netlify Background Functions for long-running tasks

### Backend Deployment Options

Since the backend requires executing CLI commands, consider:

1. **Railway** - Good for Node.js apps with long-running processes
2. **Render** - Free tier available, supports background workers
3. **Fly.io** - Good for containerized apps
4. **Heroku** - Traditional PaaS option
5. **AWS/GCP/Azure** - For production deployments

### Environment Variables

Set these in Netlify (or your backend hosting):

- `NODE_ENV` - Set to `production` for production builds
- `PORT` - Server port (usually auto-assigned)
- `DATA_OPS_CLI_PATH` - Path to data-ops CLI (if not in PATH)

## Kontent.ai Custom App Deployment

For deploying as a Kontent.ai custom app:

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Zip the dist/ directory:**
   ```bash
   cd dist
   zip -r ../data-ops-app.zip .
   ```

3. **Upload to Kontent.ai:**
   - Go to your Kontent.ai project
   - Navigate to Custom Apps
   - Upload the zip file
   - Configure the app settings

## Development vs Production

### Development
- Frontend and backend run together on localhost:3000
- Full API access
- Hot reloading available

### Production (Netlify Static)
- Only frontend files are deployed
- Backend must be deployed separately
- Update frontend API URLs to point to backend deployment

### Production (Kontent.ai Custom App)
- Single zip file deployment
- Runs within Kontent.ai's iframe
- Backend API runs on Kontent.ai's infrastructure (if configured)

## Troubleshooting

### Build Fails
- Check Node.js version (requires 18+)
- Ensure all dependencies are in `package.json`
- Check build logs in Netlify dashboard

### API Calls Fail
- Verify backend is deployed and accessible
- Check CORS settings
- Verify API endpoint URLs in frontend code

### CLI Commands Timeout
- Consider using background jobs/queues
- Implement command status polling instead of streaming
- Use WebSockets for real-time updates (requires different backend setup)

