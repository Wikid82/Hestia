# syntax=docker/dockerfile:1

# --- frontend: build the React/Vite SPA ---
# Alpine over Debian slim: dramatically smaller vulnerability surface for
# this app (musl/apk's package set vs Debian's) — measured via a full-severity
# Trivy scan of both before switching: node:24-slim came back with 152
# findings, node:24-alpine with 11 and zero HIGH/CRITICAL either way.
#
# Pinned by manifest-list digest, not just the tag. The multi-arch build
# runs amd64 and arm64 on separate native runners, and Docker's official
# `node` images publish each arch asynchronously — a same-day patch tag
# (e.g. 24.20.0-alpine on 2026-08-27) can have amd64 live while arm64 is
# still minutes/hours behind, which fails the arm64 leg with "no match for
# platform in manifest: not found". Only bump this to a tag whose
# manifest list already carries linux/amd64 AND linux/arm64, and update
# the digest with it. 24.19.0-alpine is the newest fully multi-arch tag.
FROM node:24.20.0-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# --- backend: cross-compile the Go binary ---
# The SQLite driver (glebarez/sqlite, backed by modernc.org/sqlite) is a
# pure-Go transpile of SQLite with no cgo involved, so a plain
# CGO_ENABLED=0 cross-compile from the Go toolchain's own GOARCH support is
# sufficient — no C cross-compiler or the `tonistiigi/xx` toolchain needed.
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS backend
WORKDIR /app
# go.mod can require a newer Go version than this base image ships (e.g.
# go.mod's own "go 1.27.0" directive vs. this image's 1.26.6) — GOTOOLCHAIN
# defaults to "local" in the official images, which refuses to build
# instead of fetching the version go.mod actually needs. auto lets the Go
# toolchain itself download and use the right version transparently, the
# same mechanism `go build`/`go test` already fall back to outside Docker.
ENV GOTOOLCHAIN=auto
COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download
COPY backend/ ./backend/
ARG TARGETARCH
ENV CGO_ENABLED=0
RUN cd backend && GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/hestia ./cmd/api

# --- runner: minimal production image ---
FROM alpine:3.24 AS runner
WORKDIR /app

# tzdata: lets the TZ env var control time.Local (chore due-dates are
# computed from the container's local clock). ca-certificates: needed for
# any outbound HTTPS calls now or in the future.
RUN apk add --no-cache tzdata ca-certificates

# patching known CVE's

# renovate: datasource=repology depName=alpine_3_20/openssl3 versioning=loose
ENV LIBSSL_VERSION="3.5.8-r0"

RUN apk update && \
    apk add --no-cache \
    "libssl3=${LIBSSL_VERSION}" \
    "libcrypto3=${LIBSSL_VERSION}"


ENV GIN_MODE=release
ENV DB_PATH=/data/hestia.db
ENV STATIC_DIR=/app/web
ENV PORT=8080

# Create a dedicated non-root user at UID/GID 1000, matching the default
# first non-root user on most single-user Linux hosts (mirrors the "node"
# user convention the old Next.js image relied on). If your host user has a
# different UID, either run `chown -R 1000:1000 ./data` once, or set
# `user: "<uid>:<gid>"` in docker-compose.yml to match your host user
# instead.
RUN addgroup -g 1000 hestia && adduser -D -u 1000 -G hestia hestia \
    && mkdir -p /data && chown hestia:hestia /data

COPY --from=backend /out/hestia /app/hestia
COPY --from=frontend --chown=hestia:hestia /app/frontend/dist /app/web

USER hestia
VOLUME ["/data"]
EXPOSE 8080

CMD ["/app/hestia"]
