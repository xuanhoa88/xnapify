# =============================================================================
# Build Stage
# =============================================================================
FROM node:18-alpine AS builder

# Build tools for native modules (sqlite3 requires node-gyp → python3/make/g++)
RUN apk add --no-cache python3 make g++

WORKDIR /build

# Copy package files and setup script
COPY package*.json ./
COPY tools/npm/ ./tools/npm/

# Install ALL dependencies (including devDependencies for build)
RUN npm run setup

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
RUN XNAPIFY_HOST=0.0.0.0 npm run build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:18-alpine

# Runtime dependencies for privilege dropping and embedded database engines.
# - su-exec: drop root privileges in entrypoint
# - gcompat: glibc shim so glibc-linked PG/MySQL binaries run on Alpine musl
# - Shared libs for PostgreSQL: libstdc++ icu-libs readline zlib openssl
#   PG 18+: lz4-libs zstd-libs (WAL/TOAST compression), libxml2 (SQL/XML)
# - Shared libs for MySQL: libaio numactl ncurses-libs
# - Tools for MySQL download/extract: curl xz
# - tzdata: timezone tables for MySQL SET time_zone = 'UTC'
RUN apk add --no-cache su-exec gcompat libstdc++ icu-libs readline zlib openssl \
    lz4-libs zstd-libs libxml2 \
    curl xz libaio numactl ncurses-libs tzdata

WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /build/build ./build

# Copy pre-compiled database drivers from builder stage
# The sandbox directory contains the actual compiled binaries
COPY --from=builder /build/.data/sequelize-drivers ./build/.data/sequelize-drivers

# Install production dependencies (.npmrc in build/ forces production=true)
WORKDIR /app/build
RUN npm run setup && npm cache clean --force

# Recreate driver symlinks (preboot.js ensureDeps creates these, but symlinks
# don't survive COPY --from across Docker stages)
RUN ln -sf ../.data/sequelize-drivers/sqlite/node_modules/sqlite3 node_modules/sqlite3 \
 && ln -sf ../.data/sequelize-drivers/postgres/node_modules/pg node_modules/pg \
 && ln -sf ../.data/sequelize-drivers/postgres/node_modules/pg-hstore node_modules/pg-hstore \
 && ln -sf ../.data/sequelize-drivers/mysql/node_modules/mysql2 node_modules/mysql2

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
