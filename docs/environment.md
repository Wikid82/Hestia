# Environment variables

Every environment variable Hestia's backend reads (`backend/internal/config/config.go`),
what it defaults to, and what each option does. `.env.example` at the repo root is the
quick-reference version of this file — copy it to `.env`, uncomment what you need. For the
*why* behind the security-relevant defaults (SMTP env-var-only, `ALLOW_PUBLIC_SIGNUP` closed
by default), see [CLAUDE.md](../CLAUDE.md)'s "Product shape" section.

Variables marked **Docker Compose: not applicable** are still real, read by the Go binary —
they just aren't wired through `docker-compose.yml`'s `environment:` block (the Dockerfile
sets its own fixed values for the containerized deployment), so setting them in `.env` has no
effect unless you're running the backend directly (`go run ./cmd/api`) or you edit
`docker-compose.yml` yourself.

## Precedence: `.env` vs. shell vs. `docker-compose.override.yml`

There are two different mechanisms here, and they don't have the same precedence rules —
picking the wrong one for a given variable silently does nothing, with no error.

**`.env` only fills in `${VAR}` placeholders in `docker-compose.yml` — it isn't injected into
the container directly.** There's no `env_file:` directive on the service, so a variable in
`.env` only takes effect if `docker-compose.yml` actually references it as `${VAR}` somewhere
(every variable in this doc already does; a new one wouldn't until wired in — see
[CLAUDE.md](../CLAUDE.md)'s Conventions section). For that interpolation, in order of what
wins:

1. A shell/CLI-level variable (`FOO=x docker compose up`, or `export FOO=x` beforehand) —
   **highest**.
2. `.env` — used only if the shell didn't set it.
3. The compose file's own `:-default` fallback (e.g. `${TZ:-UTC}`) — used only if neither of
   the above set it.

**A hardcoded value in `docker-compose.override.yml`'s `environment:` block always wins,
full stop — including over a shell-exported variable.** This isn't interpolation at all:
Compose merges the override file's `environment:` map over the base file's by key, *after*
the base file's own `${VAR}` has already been resolved, so the override's literal string just
replaces it outright. Verified directly: with `SMTP_HOST: hardcoded-value` written in
`docker-compose.override.yml`, `SMTP_HOST=something-else docker compose up` still gets the
hardcoded value — the shell variable is silently ignored for that key.

**Practical rule: pick exactly one place per variable.** `docker-compose.override.yml.example`
ships commented-out literal values for `BASE_URL`/`SMTP_*`/`ALLOW_PUBLIC_SIGNUP` as a
convenience for personal, don't-commit values — but if you uncomment one there, `.env`
becomes dead for that specific variable with no warning. For most setups, `.env` alone is
simpler and sufficient; reach for the override file's `environment:` block only if you
specifically want a value that survives even when something else sets the same variable in
your shell (e.g. a systemd unit or CI environment that happens to export it).

## Required

### `AUTH_SECRET`

- **Default**: none — the server refuses to start without it.
- Random secret used to sign session cookies (household and profile JWTs). Generate one with:
  ```
  openssl rand -base64 32
  ```
  Changing this value invalidates every existing session (everyone gets logged out).

## Core

### `DB_PATH`

- **Default**: `./data/hestia.db`
- **Docker Compose**: not applicable — `docker-compose.yml` hardcodes `/data/hestia.db`
  inside the container, mapped to `./data` on the host via the bind mount. Only relevant
  when running the backend directly.
- Path to the SQLite database file. Created automatically on first run, including parent
  directories.

### `TZ`

- **Default**: `UTC`
- IANA timezone (e.g. `America/New_York`, `Europe/London`). Chore due-dates and "due today"
  are computed from the container's local clock (Go's `time.Local`, backed by the `tzdata`
  package in the image), so this should match your household, not wherever the server
  physically lives. Left unset, chores flip to the next day at UTC midnight instead of local
  midnight.

### `PORT`

- **Default**: `8080`
- **Docker Compose**: not applicable — the Dockerfile sets this itself
  (`ENV PORT=8080`), and `docker-compose.yml` maps host port 8080 to it.
- Port the HTTP server listens on.

### `STATIC_DIR`

- **Default**: unset (don't serve static files)
- **Docker Compose**: not applicable — the Dockerfile sets this itself (`ENV
  STATIC_DIR=/app/web`) so the container serves the built frontend from the same binary.
- Directory containing the built frontend (`frontend/dist`) for the Go server to also serve
  as static files, with client-side routes falling back to `index.html`. Leave unset for
  local development, where the frontend runs as its own Vite dev server instead.

### `GIN_MODE`

- **Default**: unset (Gin's own default, `debug`)
- **Docker Compose**: not applicable — the Dockerfile sets `ENV GIN_MODE=release`.
- **Options**: `release` (production — less verbose logging, no debug warnings) | anything
  else / unset (debug mode, the right choice for local development).
- `NODE_ENV=production` has the same effect as `GIN_MODE=release` (legacy from before the Go
  rewrite); either is fine, `GIN_MODE` is preferred going forward.

## Outbound email (optional — enables the invite system)

All of this is optional. Leave everything below unset to run without outbound email
entirely — every other feature works fine without it, but invites can't be sent (there'd be
no way to deliver the invite link).

If you set any of `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM`, you must set all three
(`SMTP_USERNAME`/`SMTP_PASSWORD` are only required if your relay needs auth) **and**
`BASE_URL`, or the server refuses to start — better to fail fast at boot than silently never
send an email.

### `BASE_URL`

- **Default**: none. Required once any `SMTP_*` variable is set; otherwise unused.
- The externally-reachable URL of this instance, e.g. `https://hestia.example.com`. Used to
  build links (invite-accept links) in outbound email.

### `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`

- **Default**: none. Must all be set together to enable outbound email.
- Your SMTP relay's hostname, port, and the "From" address Hestia sends as.

### `SMTP_USERNAME`, `SMTP_PASSWORD`

- **Default**: none — optional even when SMTP is otherwise configured, for relays that don't
  require authentication (e.g. an internal Postfix/mailhog).

### `SMTP_USE_TLS`

- **Default**: `true`
- **Options**: `true` (connect via implicit TLS — the common pattern on port 465) | `false`
  (plaintext connection that opportunistically upgrades via STARTTLS if the server offers
  it — the common pattern on port 587/25).

## Signup

### `ALLOW_PUBLIC_SIGNUP`

- **Default**: `false`
- **Options**: `false` (only the very first signup on a fresh instance is ever allowed —
  that's how you bootstrap it; everyone after that needs an invite) | `true` (every signup
  stays open, not just the first).
- Gates `POST /auth/signup`. The very first signup always succeeds regardless of this
  setting, so bootstrapping a fresh instance is never blocked by it.

---

**Adding a new environment variable?** Update this file and `.env.example` in the same
change — see the note in [CLAUDE.md](../CLAUDE.md)'s Conventions section.
