#!/bin/sh
set -e

# Ensure the build directory is writable by the node user (uid 1000)
# This is needed because Docker named volumes mount as root
if [ "$(id -u)" = "0" ]; then
  chown node:node /app/build
  exec su-exec node "$@"
else
  exec "$@"
fi
