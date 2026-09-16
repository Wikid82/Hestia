---
id: quick-start
title: Quick start
description: Get a Hestia instance running with Docker in a few minutes.
---

# Quick start

The fastest path to a running Hestia instance is Docker Compose.

## 1. Get the code

```bash
git clone https://github.com/Wikid82/Hestia.git
cd Hestia
```

## 2. Configure the minimum required settings

```bash
cp .env.example .env
```

Open `.env` and set:

- **`AUTH_SECRET`** — required, the server won't start without it. Generate
  one with:
  ```bash
  openssl rand -base64 32
  ```
- **`TZ`** — your household's IANA timezone (e.g. `America/New_York`).
  Chore due-dates are computed from the container's local clock, so
  without this, chores roll over at UTC midnight instead of your local
  midnight.

Everything else in `.env.example` is optional for a first run — see
[environment variables](https://github.com/Wikid82/Hestia/blob/main/docs/environment.md)
for the full reference if you want to enable outbound email (invites) or
open public signup.

## 3. Start it

```bash
docker compose up -d
```

Hestia is now available at `http://localhost:8080`. The SQLite database
lives in `./data/hestia.db` on the host via a bind-mounted volume — back up
that one file to back up your whole household's data.

## 4. Create your household

The **first account you sign up with** becomes that household's Head of
Household (HoH) and this instance's system admin. By default, nobody else
can self-signup after that — everyone else joins by invite, sent from the
admin/household settings screens once you're logged in (this requires
outbound email to be configured; see the environment reference above).

## 5. Add chores

Once logged in as the HoH:

1. Add household members (or set up managed/avatar-picker profiles for
   kids without their own email).
2. Create a chore — set a name, an optional recurrence (daily, weekly,
   weekdays, or custom), a point value, and either assign it to a specific
   person or leave it open for anyone to claim.
3. Household members check off chores as they complete them and earn
   points.

## Running behind a reverse proxy

Hestia works out of the box behind Caddy, Traefik, Nginx Proxy Manager, or
similar, as long as the proxy forwards the original `Host` header (all
three do this by default). Serving from a domain or subdomain root (e.g.
`https://hestia.example.com`) needs no extra configuration — just proxy to
the container's port 8080. Serving from a reverse-proxy subpath isn't
supported yet.

## Developing locally

See the
[README's "Developing locally" section](https://github.com/Wikid82/Hestia#developing-locally)
for running the backend and frontend as separate processes instead of via
Docker.
