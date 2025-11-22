# Netlify Functions

This directory would contain Netlify Functions if you want to convert the Express API to serverless functions.

## Important Limitations

⚠️ **Netlify Functions have significant limitations for this use case:**

1. **Timeout Limits:**
   - Free tier: 10 seconds
   - Paid tier: 26 seconds
   - CLI commands may take much longer

2. **No Server-Sent Events (SSE):**
   - The current API uses SSE for streaming command output
   - Functions don't support SSE well
   - Would need to refactor to polling or WebSockets

3. **File System Access:**
   - Limited to `/tmp` directory
   - No persistent storage
   - CLI commands may need file system access

4. **Child Process Execution:**
   - Functions can execute child processes
   - But long-running processes may timeout
   - Memory limits apply

## Alternative Approach

Instead of converting to Functions, consider:

1. **Deploy backend separately** to a platform that supports:
   - Long-running processes (Railway, Render, Fly.io)
   - File system access
   - No timeout limits

2. **Update frontend** to point to the separate backend URL:
   ```javascript
   // In app-frontend.js, update:
   serverUrl: process.env.REACT_APP_API_URL || window.location.origin
   ```

3. **Use environment variables** in Netlify to configure the API URL

## If You Still Want to Try Functions

Example structure:
```
netlify/functions/
├── commands.js          # GET /api/commands
├── execute.js           # POST /api/execute
└── fetch-entities.js    # POST /api/fetch-entities
```

Each function would need to:
- Handle the request
- Execute the CLI command (with timeout handling)
- Return response (no streaming)
- Handle errors gracefully

