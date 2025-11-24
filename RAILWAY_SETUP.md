# Railway Backend Setup Complete ✅

Your backend is deployed at:
**https://kontent-data-ops-custom-app-production.up.railway.app**

## ✅ What's Been Configured

1. **Frontend Updated** - Now points to your Railway backend
2. **CORS Configuration** - Backend accepts requests from your frontend
3. **Environment Variable Support** - Can override API URL via Netlify

## 🔧 Railway Environment Variables

Make sure these are set in your Railway dashboard:

1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Ensure these are set:

```
NODE_ENV=production
CORS_ORIGIN=https://your-netlify-site.netlify.app
```

(Replace with your actual Netlify frontend URL once deployed)

## 🌐 Frontend Configuration

The frontend is now configured to use your Railway backend:

- **Production**: Automatically uses Railway URL
- **Development**: Uses `localhost:3000`
- **Override**: Can be set via Netlify environment variable `REACT_APP_API_URL`

## 🧪 Test Your Backend

### 1. Health Check
```bash
curl https://kontent-data-ops-custom-app-production.up.railway.app/health
```
Expected: `{"status":"ok"}`

### 2. API Endpoint
```bash
curl https://kontent-data-ops-custom-app-production.up.railway.app/api/commands
```
Expected: JSON with command definitions

### 3. Check Logs
In Railway dashboard → Your service → Logs

## 🚀 Next Steps

1. **Deploy Frontend to Netlify**
   - Push changes to GitHub
   - Netlify will auto-deploy
   - Frontend will automatically connect to Railway backend

2. **Update CORS in Railway** (if needed)
   - Once you have your Netlify URL
   - Update `CORS_ORIGIN` in Railway variables
   - Include: `https://your-netlify-site.netlify.app`

3. **Test End-to-End**
   - Visit your Netlify site
   - Try running a command
   - Check Railway logs for backend activity

## 🔍 Troubleshooting

### CORS Errors
- Verify `CORS_ORIGIN` in Railway includes your Netlify URL
- Check browser console for specific CORS error
- Ensure no trailing slashes in URLs

### API Not Responding
- Check Railway logs: Dashboard → Service → Logs
- Verify health endpoint: `/health`
- Check Railway service status

### Frontend Can't Connect
- Verify Railway URL is correct
- Check browser network tab
- Ensure backend is running (check Railway dashboard)

## 📝 Custom Domain (Optional)

If you want a custom domain for your Railway backend:

1. In Railway dashboard → Your service → Settings
2. Click "Generate Domain" or add custom domain
3. Update frontend `serverUrl` to use new domain
4. Update DNS records as instructed

## ✅ Verification Checklist

- [x] Backend deployed to Railway
- [x] Health endpoint working (`/health`)
- [x] API endpoint accessible (`/api/commands`)
- [x] Frontend updated to use Railway URL
- [ ] Frontend deployed to Netlify
- [ ] CORS_ORIGIN set in Railway (with Netlify URL)
- [ ] End-to-end test successful


