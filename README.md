<p align="center">
  <img src="public/images/hestia_banner.png" alt="Hestia" width="240">
</p>

# Hestia

A self-hosted household chore chart for families. Add your chores, assign
them (or let anyone claim them), check them off, and earn points — no
subscription, no cloud account, your data stays on your own server.

Hestia exists because most task trackers you'll find are built for software
teams, not families. It's meant to be free, simple, and something a
non-technical family member can actually use from a tablet on the fridge.

## Status

Early days — this is a fresh scaffold, not yet a usable app. See
[CLAUDE.md](./CLAUDE.md) for the project's conventions and current
architecture decisions.

## Planned features (v1)

- Household accounts with a shared login, and a tap-your-avatar picker for
  whoever's actually using the screen (kid-friendly, no passwords required
  for kids)
- Optional PIN per person for restricted actions
- Recurring chores (daily / weekly / custom schedule)
- Points and streaks per person
- Works well on a phone, a wall-mounted tablet, or a Raspberry Pi-hosted
  browser

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com)
- [SQLite](https://sqlite.org) via [Drizzle ORM](https://orm.drizzle.team) —
  one file, no separate database server to run
- Docker, built for both amd64 and arm64 (Raspberry Pi / ARM NAS friendly)

## Running it (Docker)

```bash
git clone https://github.com/Wikid82/hestia.git
cd hestia
cp .env.example .env   # set AUTH_SECRET, and TZ to your household's timezone
docker compose up -d
```

The app will be available at `http://localhost:3000`. The SQLite database
lives in `./data/hestia.db` on the host, via a bind-mounted volume — back up
that one file to back up your whole household's data.

Set `TZ` to your household's IANA timezone (e.g. `America/New_York`) —
chore due-dates are computed from the container's local clock, so without
it everything runs on UTC regardless of where you actually are, and chores
flip to the next day at UTC midnight instead of local midnight.

## Developing locally

```bash
npm install
cp .env.example .env
npm run dev
```

Database migrations run automatically on startup (see
`src/instrumentation.ts`). After changing `src/db/schema.ts`, generate a new
migration with:

```bash
npm run db:generate
```

## License

[MIT](./LICENSE) — free for anyone to use, fork, or self-host.
