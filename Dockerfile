# Production Dockerfile for Hugging Face Spaces & Cloud Deployment
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

# Create non-root user with UID 1000 required by Hugging Face Spaces
RUN useradd -m -u 1000 user

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=7860
ENV HOME=/home/user

WORKDIR /home/user/app

# Copy package definition and install production dependencies with native rebuilding
COPY --chown=user:user package*.json ./
RUN npm ci --omit=dev && npm rebuild sqlite3 --build-from-source

# Copy application code with proper ownership
COPY --chown=user:user . .

# Ensure storage directories exist with write permissions
RUN mkdir -p database sessions logs reports tmp && chown -R user:user /home/user

USER user

# Expose port (HuggingFace default: 7860)
EXPOSE 7860

# Start application server
CMD ["node", "server.js"]
