# syntax=docker/dockerfile:1

FROM node:24.19.0-slim AS base

# --- deps: install deps once, with build tools available for better-sqlite3's
# native module in case no prebuilt binary exists for the target arch ---
FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: build the Next.js app ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/hestia.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Reuse the "node" user (UID/GID 1000) that ships in the base image, which
# matches the default first non-root user on most single-user Linux hosts.
# If your host user has a different UID, either run `chown -R 1000:1000
# ./data` once, or set `user: "<uid>:<gid>"` in docker-compose.yml to match
# your host user instead.
RUN mkdir -p /data && chown node:node /data

# Next.js standalone output traces and includes only the node_modules actually
# needed at runtime, including better-sqlite3's compiled native binary.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle

USER node
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
