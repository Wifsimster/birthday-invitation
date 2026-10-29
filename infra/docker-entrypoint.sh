#!/bin/sh
set -e

/inject-env.sh

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node node /app/server/server.ts
fi

exec node /app/server/server.ts
