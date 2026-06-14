#!/bin/sh
# Docker entrypoint: inject runtime config into the SPA, then run the server.
# A single Node process serves both the static SPA and the API.
set -e

# Write dist/env.js from environment variables.
/inject-env.sh

# Replace the shell with the Node process so it receives signals (SIGTERM) and
# the server's graceful shutdown runs.
exec node /app/server/server.js
