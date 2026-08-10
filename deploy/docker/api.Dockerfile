# Express API + Socket.IO gateway.
#
# Socket.IO runs inside this process; there is no separate realtime service.
# Debian slim rather than Alpine: Prisma's engines and the OpenSSL they link
# against are glibc builds, and musl variants have been a recurring source of
# runtime engine failures.
FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /repo

# ---------- dependencies ----------
FROM base AS deps
# Installed with dev dependencies because the build needs TypeScript and the
# Prisma CLI. Only the compiled output is copied into the runtime stage.
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
COPY apps/api/ apps/api/
RUN npm run prisma:generate \
  && npm run build --workspace @pics-nigeria/shared \
  && npm run build --workspace @pics-nigeria/object-storage \
  && npm run build --workspace @pics-nigeria/api

# ---------- migration runner ----------
# A separate target, not the runtime image. Applying migrations needs the Prisma
# CLI and the verification script, both of which are development-only tooling
# that must not ship inside the long-running API container.
FROM build AS migrate
COPY scripts/ scripts/
USER node
CMD ["sh", "-c", "node scripts/verify-migration-integrity.mjs && npx --no-install prisma migrate deploy --config packages/database/prisma.config.ts"]

# ---------- runtime ----------
FROM base AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

# Prune to production dependencies only, so dev tooling never ships.
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
  && npm ci --omit=dev --workspace @pics-nigeria/api --include-workspace-root

COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/object-storage/dist packages/object-storage/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
# The schema and generated client are required at runtime by @prisma/client.
COPY --from=build /repo/packages/database/prisma packages/database/prisma
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma/client node_modules/@prisma/client

# The stock non-root user ships with the image; no secret or credential is
# baked in at any layer.
USER node
EXPOSE 4000

# Compose owns restart policy; the container reports its own liveness here.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
