# BullMQ background worker.
#
# Debian slim rather than Alpine on purpose: sharp and the Prisma engines are
# native, glibc-linked builds. Alpine would require the musl variants of both
# and buys only image size.
FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /repo

# ---------- dependencies ----------
FROM base AS deps
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
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
ENV NODE_ENV=development
COPY tsconfig.base.json ./
# Ambient declarations resolved through tsconfig typeRoots; the build fails
# without them.
COPY types/ types/
COPY packages/ packages/
COPY apps/worker/ apps/worker/
RUN npm run prisma:generate \
  && npm run build --workspace @pics-nigeria/shared \
  && npm run build --workspace @pics-nigeria/object-storage \
  && npm run build --workspace @pics-nigeria/worker

# ---------- runtime ----------
FROM base AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/database/package.json packages/database/
COPY packages/object-storage/package.json packages/object-storage/
COPY packages/shared/package.json packages/shared/
# sharp's native binary is selected by the os/cpu-gated optional dependencies
# recorded in the lockfile, so this resolves the linux-x64 build here.
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm ci --omit=dev --workspace @pics-nigeria/worker --include-workspace-root

COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/object-storage/dist packages/object-storage/dist
COPY --from=build /repo/apps/worker/dist apps/worker/dist
COPY --from=build /repo/packages/database/prisma packages/database/prisma
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma/client node_modules/@prisma/client

USER node
EXPOSE 4100

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=4 \
  CMD wget -qO- http://127.0.0.1:${WORKER_HEALTH_PORT:-4100}/health || exit 1

# The worker traps SIGTERM and closes queues before exiting, so in-flight jobs
# record their outcome instead of being stranded in PROCESSING.
STOPSIGNAL SIGTERM
CMD ["node", "apps/worker/dist/apps/worker/src/index.js"]
