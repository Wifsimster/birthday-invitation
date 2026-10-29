FROM node:24-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine

ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF
LABEL org.opencontainers.image.title="birthday-invitation" \
      org.opencontainers.image.source="https://github.com/wifsimster/birthday-invitation" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && (cd server && npm ci --omit=dev) \
 && apk del .build-deps

COPY server/ ./server/

COPY --from=frontend /build/dist ./dist

COPY infra/inject-env.sh /inject-env.sh
COPY infra/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /inject-env.sh /docker-entrypoint.sh

RUN apk add --no-cache su-exec \
 && mkdir -p /app/data && chown -R node:node /app

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
