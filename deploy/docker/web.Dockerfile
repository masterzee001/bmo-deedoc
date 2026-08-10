# Next.js web frontend, served as a container behind the reverse proxy.
FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /repo

# ---------- dependencies ----------
FROM base AS deps
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/database/package.json packages/database/
COPY packages/object-storage/package.json packages/object-storage/
COPY packages/shared/package.json packages/shared/
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm ci --include=dev

# ---------- build ----------
FROM deps AS build
ENV NODE_ENV=production
# NEXT_PUBLIC_* values are compiled into the client bundle, so they must be
# supplied at build time. They are public endpoint URLs, never secrets.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_REALTIME_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
COPY tsconfig.base.json ./
# Ambient declarations resolved through tsconfig typeRoots; the build fails
# without them.
COPY types/ types/
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN npm run build --workspace @pics-nigeria/shared \
  && npm run build --workspace @pics-nigeria/web

# ---------- runtime ----------
FROM base AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

# The standalone output already contains the traced dependency tree, so the
# runtime stage needs no npm install at all.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
# apps/web has no public/ directory; add a COPY for it here if static assets
# are introduced, since standalone output does not include them.

USER node
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/web/server.js"]
