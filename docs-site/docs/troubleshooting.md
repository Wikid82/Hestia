---
id: troubleshooting
title: Troubleshooting
description: Fixes for common self-hosting issues with Hestia.
---

# Troubleshooting

## The server won't start / exits immediately

Check the container logs first:

```bash
docker compose logs hestia
```

The most common cause is a missing **`AUTH_SECRET`** — Hestia refuses to
start without it. Set it in `.env`:

```bash
openssl rand -base64 32
```

If you've configured any `SMTP_*` variable, all of `SMTP_SERVER`,
`SMTP_PORT`, `SMTP_FROM`, and `BASE_URL` must be set together, or the
server also refuses to start — see
[environment variables](https://github.com/Wikid82/Hestia/blob/main/docs/environment.md)
for the full list.

## Chores flip over at the wrong time of day

Set **`TZ`** to your household's IANA timezone (e.g. `America/New_York`)
in `.env`. Without it, chore due-dates are computed against UTC, so
chores roll over at UTC midnight instead of your local midnight.

## I can't log in after setting `COOKIE_SECURE=true`

`COOKIE_SECURE=true` marks auth cookies `Secure`, which browsers only send
over HTTPS. Only enable this once you have a TLS-terminating reverse proxy
(Caddy, Traefik, nginx) in front of your instance — otherwise leave it at
the default `false`.

## Invite emails aren't sending

Outbound email is optional and off by default. To enable it, set all of
`SMTP_SERVER`, `SMTP_PORT`, `SMTP_FROM`, and `BASE_URL` (plus
`SMTP_USERNAME`/`SMTP_PASSWORD` if your relay requires auth). Without
SMTP configured, everything else in Hestia still works — you just can't
send invite links by email.

## Port 8080 is already in use

Another process is bound to the host port Hestia's Compose file maps by
default. Either stop that process, or change the host-side port mapping
in `docker-compose.yml` (the container's internal port stays `8080`).

## The database file has the wrong permissions

Hestia's SQLite database lives at `./data/hestia.db` on the host via a
bind mount. If the container user can't write to it (common after
copying `data/` from another machine or restoring a backup), fix
ownership on the host:

```bash
sudo chown -R $(id -u):$(id -g) ./data
```

## "First signup" didn't get admin

Only the **very first signup on a fresh instance** automatically becomes
that household's HoH and the instance's system admin. If you've already
completed a signup before (even one you don't remember, e.g. during
testing), later signups won't get admin automatically — see the
[FAQ](./faq.md) for how roles work.

## Still stuck?

Open an issue on
[GitHub](https://github.com/Wikid82/Hestia/issues) with your Docker Compose
setup (redact secrets) and the relevant log output.
