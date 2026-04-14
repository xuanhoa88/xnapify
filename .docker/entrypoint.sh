#!/bin/sh
set -e

# Ensure writable directories for the node user (uid 1000)
# Docker named volumes mount as root — fix ownership before dropping privileges
if [ "$(id -u)" = "0" ]; then
  # App build dir (preboot installs DB drivers here)
  chown node:node /app/build

  # Bundled extensions dir (extension activation runs npm install --omit=dev here)
  # Only chown if ownership is wrong (avoids O(n) walk on every restart)
  if [ -d /app/build/extensions ] && [ "$(stat -c '%u' /app/build/extensions 2>/dev/null)" != "1000" ]; then
    chown -R node:node /app/build/extensions
  fi

  # Persistent data dir (uploads, extensions, Node-RED, caches, FTS, sqlite)
  # Subdirectories are created by the app on first use
  mkdir -p /home/node/.xnapify
  if [ "$(stat -c '%u' /home/node/.xnapify 2>/dev/null)" != "1000" ]; then
    chown -R node:node /home/node/.xnapify
  fi

  exec su-exec node "$@"
else
  exec "$@"
fi
