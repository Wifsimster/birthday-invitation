# Birthday Invitation — runtime image
#
# NOTE: This repository was reconstructed from the published Docker image
# (wifsimster/birthday-invitation:latest). The original Vite frontend *source*
# was not present in the image, so the pre-built SPA in dist/ is committed as-is
# and this Dockerfile assembles the runtime from those built assets rather than
# building the frontend from source.
#
# Caddy serves dist/ and proxies /api/* to the Node backend; supervisord runs
# both processes. See infra/ for the process and proxy configuration.

FROM node:20-alpine

# Build metadata stamped by the Release workflow (see .github/workflows/
# release.yml). Defaults keep plain `docker build` working without --build-arg.
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF
LABEL org.opencontainers.image.title="birthday-invitation" \
      org.opencontainers.image.source="https://github.com/wifsimster/birthday-invitation" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# Caddy (static serving + reverse proxy) and supervisord (process manager)
RUN apk add --no-cache caddy supervisor

WORKDIR /app

# Backend (Express + SQLite) — install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/

# Pre-built frontend SPA
COPY dist/ ./dist/

# Infra: process manager, reverse proxy, runtime env injection
COPY infra/supervisord.conf /etc/supervisord.conf
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY infra/inject-env.sh /inject-env.sh
COPY infra/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /inject-env.sh /docker-entrypoint.sh

# Caddy listens on 3000; backend on 3001 (internal, proxied by Caddy)
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
