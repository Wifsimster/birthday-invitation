#!/bin/sh
# Docker entrypoint script to run both backend and frontend in production

# Inject environment variables into frontend
/inject-env.sh

# Use supervisord to manage both caddy and backend processes
exec supervisord -c /etc/supervisord.conf
