@AGENTS.md

# Hestia

A self-hosted, family-focused household chore chart. Free, MIT-licensed, no
account/cloud requirement — built for the self-hosted community because
existing chore-chart apps are either subscription SaaS (e.g. Sweepy) or
software-team task trackers repurposed for a use case they weren't designed
for.

## Who's building this

The user (Jeremy) is directing this as a "vibe coded" project: he sets
product direction and reviews, Claude does essentially all the implementation
work. Default to making reasonable implementation calls yourself rather than
asking permission for routine decisions — but flag anything that's a real
product or architecture fork in the road (auth approach, data model shape,
adding a new external dependency) before just doing it.

## Workflow

Do not use git worktrees for work in this repo — work directly on a branch
in the normal checkout. Jeremy likes to build and test the app himself
before merging, and a worktree puts the change somewhere he isn't already
looking.

## Product shape

- **Users**: parents/admins who can log into a household account remotely,
  plus kid profiles that don't need their own credentials for daily use.
- **Auth model**: one household account (email/password) for remote access.
  Once logged in, an avatar picker (Netflix-profile style) lets whoever's at
  the shared screen select themselves. Each profile can optionally have a PIN
  gating restricted actions (editing chores, redeeming points) — this is one
  auth system, not two.
- **Chores**: can repeat (daily/weekly/weekdays/custom), can be assigned to a
  specific person or left open for anyone in the household to claim, and
  award points on completion. Points/streaks are the only gamification layer
  planned for v1 — keep it simple, this is a chore chart, not a game.
- **No background jobs.** Recurrence is computed on read (e.g. "is this
  chore due today"), not via cron/scheduled workers — there's no
  infrastructure for that and it isn't needed for a chore chart.

## Stack and why

- **Next.js (App Router, TypeScript)** — most reliable code generation for a
  vibe-coded project, huge ecosystem, one process to deploy.
- **SQLite via Drizzle ORM** (`better-sqlite3` driver) — a self-hoster should
  be able to back up the entire app by copying one file. Do not introduce
  Postgres/MySQL/Redis/etc. without discussing it first — that's a real
  architecture change, not a routine call.
- **Tailwind CSS** for styling.
- **Docker**, built multi-arch (amd64 + arm64) — a lot of the self-hosted
  audience runs on Raspberry Pi or ARM NAS boxes. Keep the image and runtime
  footprint light; avoid dependencies that only ship prebuilt binaries for
  x86.
- Migrations run automatically on server boot via `src/instrumentation.ts`
  (uses `drizzle-orm`'s own migrator against the `drizzle/` SQL files — not
  the `drizzle-kit` CLI, which isn't in the production image). After editing
  `src/db/schema.ts`, run `npm run db:generate` to produce a new migration
  and commit it.

## Conventions

- Server Components by default; only add `"use client"` where interactivity
  actually requires it (forms, avatar picker, checkboxes).
- Prefer Server Actions over hand-rolled API routes for mutations, unless
  something genuinely needs a REST/JSON endpoint.
- No abstraction for a single call site. No config/feature-flag scaffolding
  for hypothetical future options. Three similar lines beat a premature
  helper.
- Before calling a feature done: run `npm run build` and `npm run lint`.
  There's no test suite yet — don't add one speculatively; add tests when
  there's logic worth protecting (e.g. recurrence-date calculation), not for
  CRUD boilerplate.
- Keep the Docker image and `docker-compose.yml` in sync with any new
  required environment variables (update `.env.example` too).

## Subagents

Not set up yet — there isn't enough codebase structure to divide up
profitably. Revisit once the core data model, auth, and chore CRUD exist;
likely candidates at that point are a schema/migrations owner and leaning on
the existing `code-review` skill for review passes, rather than a large
fixed agent roster.
