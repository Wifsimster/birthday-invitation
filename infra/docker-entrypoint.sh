#!/bin/sh
# Docker entrypoint: inject runtime config into the SPA, then run the server.
# A single Node process serves both the static SPA and the API. The server is
# TypeScript, run directly via Node 24's native type stripping (no build step).
set -e

# Write dist/env.js from environment variables.
/inject-env.sh

# The server runs as the unprivileged `node` user. When started as root (the
# normal case), reconcile ownership of the persisted data volume first — it may
# pre-date the non-root image and still be owned by root, which makes SQLite's
# WAL pragma fail with SQLITE_READONLY — then drop privileges with su-exec.
# `exec` replaces the shell so the server receives signals (SIGTERM) and its
# graceful shutdown runs. If already unprivileged (e.g. `docker run --user`),
# exec the server directly.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node node /app/server/server.ts
fi

exec node /app/server/server.ts
