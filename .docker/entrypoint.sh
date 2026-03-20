#!/bin/sh
set -e

# Ensure writable directories for the node user (uid 1000)
# Docker named volumes mount as root — fix ownership before dropping privileges
if [ "$(id -u)" = "0" ]; then
  # App build dir (SQLite DB lives here)
  chown node:node /app/build

  # Persistent data dir (uploads, plugins, Node-RED, caches)
  # Subdirectories are created by the app on first use
  mkdir -p /app/data
  chown -R node:node /app/data

  exec su-exec node "$@"
else
  exec "$@"
fi
