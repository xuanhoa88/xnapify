# =============================================================================
# Build Stage
# =============================================================================
FROM node:18-alpine AS builder

WORKDIR /build

# Copy package files and setup script
COPY package*.json ./
COPY tools/npm/ ./tools/npm/

# Install ALL dependencies (including devDependencies for build)
RUN npm run setup

# Copy source code
COPY . .

# Install extension/sub-package dependencies
RUN node tools/npm/setup.js --skip-root

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

# Install production dependencies (.npmrc in build/ forces production=true)
WORKDIR /app/build
RUN npm run setup && npm cache clean --force

# Preboot installs DB drivers on-demand at runtime (as `node` user via su-exec)
RUN chown -R node:node /app/build

# Copy entrypoint script
COPY .docker/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 1337

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "start"]
