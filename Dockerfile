# Dockerfile for backend server deployment
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies needed for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: This will fail if data-ops and custom-app-sdk-js are not available
# You may need to publish these as npm packages or use a different approach
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build:ts

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "build/server/index.js"]

