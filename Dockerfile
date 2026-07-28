# Production Dockerfile for Render.com Deployment
FROM node:20-slim

# Install Chromium, fonts, and build dependencies for Puppeteer & SQLite
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fontconfig \
    ca-certificates \
    procps \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

# Copy package definition and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 10000

# Start application server
CMD ["node", "server.js"]
