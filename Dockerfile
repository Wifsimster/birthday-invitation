# Birthday Invitation — runtime image
#
# A single Node process serves the SPA (built from frontend/ source) and the API
# on one port — no reverse proxy or process manager. See infra/ for runtime env
# injection.

# --- Stage 1: build the Vite SPA from source ---------------------------------
FROM node:24-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Outputs to /build/dist (vite.config.js outDir: ../dist)
RUN npm run build

# --- Stage 2: runtime --------------------------------------------------------
FROM node:24-alpine

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

WORKDIR /app

# Backend (Express + SQLite) — install production deps only.
# better-sqlite3 compiles a native binding, so build tooling is installed in a
# virtual package and removed again to keep the runtime image small.
COPY server/package.json server/package-lock.json ./server/
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && (cd server && npm ci --omit=dev) \
 && apk del .build-deps

COPY server/ ./server/

# Built frontend SPA from stage 1 (served by the Node process from /app/dist)
COPY --from=frontend /build/dist ./dist

# Runtime env injection (writes dist/env.js from environment at start)
COPY infra/inject-env.sh /inject-env.sh
COPY infra/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /inject-env.sh /docker-entrypoint.sh

# Node serves SPA + API on port 3000
ENV PORT=3000
EXPOSE 3000

# Report container health from the API (busybox wget ships with the image).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
