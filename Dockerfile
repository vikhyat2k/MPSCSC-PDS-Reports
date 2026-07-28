# Production Dockerfile for Render.com Deployment
FROM node:22-bookworm-slim

# Install Chromium, fonts, and build dependencies for Puppeteer & SQLite compilation
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fontconfig \
    ca-certificates \
    procps \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=10000

WORKDIR /app

# Copy package definition and install production dependencies with native rebuilding
COPY package*.json ./
RUN npm ci --omit=dev && npm rebuild sqlite3 --build-from-source

# Copy application code
COPY . .

# Expose port
EXPOSE 10000

# Start application server
CMD ["node", "server.js"]
