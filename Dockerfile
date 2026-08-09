# syntax=docker/dockerfile:1

# Alpine over Debian slim: dramatically smaller vulnerability surface for
# this app (musl/apk's package set vs Debian's) — measured via a full-severity
# Trivy scan of both before switching: node:24-slim came back with 152
# findings, node:24-alpine with 11 and zero HIGH/CRITICAL either way.
FROM node:24.19.0-alpine AS base

# --- deps: install deps once, with build tools available for better-sqlite3's
# native module in case no prebuilt binary exists for the target arch ---
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
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

# npm (and corepack) ship in the base image but are never invoked here —
# the container only ever runs `node server.js`. Removing them eliminates
# their bundled transitive deps (undici/tar/ip-address) as a source of
# vulnerability findings entirely, rather than waiting on npm's own
# upstream to bump versions we don't control.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

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
