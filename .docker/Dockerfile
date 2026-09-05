# xnapify (https://github.com/xuanhoa88/xnapify/)
#
# This source code is licensed under the MIT license found in the
# LICENSE.txt file in the root directory of this source tree.

# =============================================================================
# Build Stage
# =============================================================================
FROM node:20-alpine AS builder

# Build tools for native modules (sqlite3 requires node-gyp → python3/make/g++)
RUN apk add --no-cache python3 py3-setuptools make g++

WORKDIR /build

# Copy package files and setup script
COPY package*.json ./
COPY tools/npm/ ./tools/npm/

# Install ALL dependencies (including devDependencies for build)
# Set npm configs to prevent network timeouts/EOF during large downloads on QEMU/Podman
RUN npm config set maxsockets 1 \
 && npm config set fetch-timeout 600000 \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm run setup

# Copy source code
COPY . .

# Install extension/sub-package dependencies
RUN npm run setup -- --skip-root

# Pre-install ALL database drivers (compiled against this Alpine/musl environment)
# sqlite3 requires node-gyp (C++ native addon) — build tools are present here
# pg + mysql2 are pure JS but pre-installing avoids runtime network access
RUN node tools/npm/preboot.js --db sqlite --install \
 && node tools/npm/preboot.js --db postgres --install \
 && node tools/npm/preboot.js --db mysql --install

# Build application
# XNAPIFY_HOST must be 0.0.0.0 inside Docker so the server binds to all interfaces
# (Webpack DefinePlugin bakes XNAPIFY_* env vars into the bundle at build time)
# Limit Node memory to 4GB and Webpack/Terser parallelism to prevent OOM errors inside VMs/Containers
RUN NODE_OPTIONS="--max-old-space-size=1024" XNAPIFY_MAX_WORKERS=1 XNAPIFY_HOST=0.0.0.0 npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20-alpine

# Runtime dependencies for privilege dropping and embedded database engines.
# - su-exec: drop root privileges in entrypoint
# - gcompat: glibc shim so glibc-linked PG binaries run on Alpine musl
# - Shared libs for PostgreSQL: libstdc++ icu-libs readline zlib openssl
#   PG 18+: lz4-libs zstd-libs (WAL/TOAST compression), libxml2 (SQL/XML)
# - mariadb + mariadb-client: musl-native MySQL-compatible server for Alpine
#   (glibc MySQL binaries cannot run on Alpine musl — MariaDB is the drop-in)
# - Tools for download/extract: curl xz
# - tzdata: timezone tables for MySQL SET time_zone = 'UTC'
RUN apk add --no-cache su-exec gcompat libstdc++ icu-libs readline zlib openssl \
    lz4-libs zstd-libs libxml2 \
    curl xz tzdata \
    mariadb mariadb-client

WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /build/build ./build

# Copy pre-compiled database drivers from builder stage
# The sandbox directory contains the actual compiled binaries
COPY --from=builder /build/.xnapify/sequelize-drivers ./build/.xnapify/sequelize-drivers

# Install production dependencies (.npmrc in build/ forces production=true)
WORKDIR /app/build
RUN npm run setup && npm cache clean --force

# Drivers are resolved straight from the sandbox at runtime — nothing is
# linked into node_modules (npm would prune it). Only permissions need fixing.
RUN chmod -R 755 /app/build/.xnapify

# Preboot installs any still-missing driver into the sandbox at runtime (as `node` user via su-exec)
RUN chown -R node:node /app/build

# Copy entrypoint script
COPY .docker/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set environment
ENV NODE_ENV=production
ENV XNAPIFY_HOST=0.0.0.0

# Expose port
EXPOSE 1337

# Declare persistent volume
VOLUME ["/home/node/.xnapify"]

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "start"]
