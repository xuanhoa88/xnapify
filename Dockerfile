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
RUN npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:18-alpine

WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /build/build ./build

# Change to build directory and install production dependencies
WORKDIR /app/build
RUN npm install --production && \
    npm cache clean --force

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 1337

# Run as non-root user
USER node

# Start server (running from /app/build directory)
CMD ["node", "server.js"]
