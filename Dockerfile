# Birthday Invitation — runtime image
#
# NOTE: This repository was reconstructed from the published Docker image. The
# original Vite frontend *source* was not present, so the pre-built SPA in dist/
# is committed as-is and this image serves those built assets.
#
# A single Node process serves the SPA (dist/) and the API on one port — no
# reverse proxy or process manager required. See infra/ for runtime env injection.

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

WORKDIR /app

# Backend (Express + SQLite) — install production deps only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/

# Pre-built frontend SPA (served by the Node process from /app/dist)
COPY dist/ ./dist/

# Runtime env injection (writes dist/env.js from environment at start)
COPY infra/inject-env.sh /inject-env.sh
COPY infra/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /inject-env.sh /docker-entrypoint.sh

# Node serves SPA + API on port 3000
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
