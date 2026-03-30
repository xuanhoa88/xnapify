# =============================================================================
# Build Stage
# =============================================================================
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build application
# XNAPIFY_HOST must be 0.0.0.0 inside Docker so the server binds to all interfaces
# (Webpack DefinePlugin bakes XNAPIFY_* env vars into the bundle at build time)
RUN XNAPIFY_HOST=0.0.0.0 npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:18-alpine

# Install su-exec for dropping privileges at runtime
RUN apk add --no-cache su-exec

WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /build/build ./build

# Install production dependencies
WORKDIR /app/build
COPY --from=builder /build/package*.json ./
RUN npm install --production && npm cache clean --force

# Copy entrypoint script
COPY .docker/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 1337

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server.js"]
