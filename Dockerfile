# Use Node.js 18 LTS (Debian slim for better compatibility)
FROM node:18-slim

# Set working directory
WORKDIR /app

# Keep system CA roots available for outbound HTTPS calls such as WeChat jscode2session.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies (with retry and verbose error output)
RUN npm install --production --no-optional --no-audit --no-fund || \
    (echo "=== npm install failed, retrying with --legacy-peer-deps ===" && \
     npm install --production --legacy-peer-deps --no-audit --no-fund)

# Copy application source
COPY . .

# Container port (cosmetic, actual port from PORT env var)
EXPOSE 3000

# Start: run migrations + seeds, then start server
CMD ["sh", "-c", "node migrations/run.js && node seeds/run.js && node src/app.js"]
