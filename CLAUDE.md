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

- Any feature work (not small edits/fixes — see below) must have a
  written spec at `docs/current_spec.md` before implementation starts,
  covering goal, key decisions (with rationale), and PR/commit slicing.
  Keep it updated as decisions change or PRs land — it's a live tracking
  doc for the in-progress feature, not a one-time writeup. Once the
  feature is fully merged to `main`, replace its contents with the next
  feature's spec rather than letting stale specs pile up. The point is to
  make multi-PR initiatives trackable so steps don't get forgotten
  between sessions.
- Do not use git worktrees for work in this repo — work directly on a
  branch in the normal checkout. Jeremy likes to build and test the app
  himself before merging, and a worktree puts the change somewhere he
  isn't already looking.
- Only switch/create a branch for major feature work. Small edits and
  fixes happen directly on whatever branch is currently checked out —
  don't branch reflexively for every change. Branch (and open a PR) when
  something is a real chore that needs build/CI testing before landing.
- CI/workflow changes (`.github/workflows/*`) are committed directly to
  `main` for now, since that's the branch CI actually runs on and needs
  to reflect immediately — `propagate-main-to-development.yml` carries
  them down to `development` automatically. Once the project is more
  mature this will switch to normal PRs against `development` like
  everything else; ask if it's unclear which regime is current.
  Exception: if a workflow file is actively broken in a way that's
  failing checks on an already-open PR, fix it directly on that PR's
  branch instead — `pull_request`-triggered checks run using the
  workflow file from the PR's own head branch, not from `main`, so a
  fix on `main` alone won't turn the open PR's checks green.
- Otherwise, open PRs against `development`, not `main`. `main` is the
  release/stable branch; `development` is the integration branch,
  periodically synced back into `main`.
- PR titles must use a Conventional Commits prefix (`feat:`, `fix:`,
  `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`,
  `chore:`, `revert:`) — enforced by `pr-title-lint.yml`. PRs are
  squash-merged, so the PR title becomes the commit message on `main`,
  and `release-please` parses that prefix to derive versions and
  changelog entries; an unprefixed title fails the check and would
  silently drop out of release automation even if merged. Individual
  commit messages within a PR aren't checked — only the PR title matters.

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

- **Go (Gin, GORM)** for the backend API — a single static-ish binary,
  cheap to cross-compile for arm64, no runtime/interpreter to ship.
- **SQLite via GORM** using the `glebarez/sqlite` driver (pure Go, backed by
  `modernc.org/sqlite` — no cgo) — a self-hoster should be able to back up
  the entire app by copying one file, and a cgo-free driver keeps
  cross-compilation for arm64 simple. Do not introduce Postgres/MySQL/
  Redis/etc. without discussing it first — that's a real architecture
  change, not a routine call.
- **React 19 + Vite + TypeScript** for the frontend, with **Tailwind CSS v4**
  for styling, **react-router v8** for routing, and **TanStack Query** for
  server-state/data-fetching.
- **`gorilla/websocket`** for realtime sync between household members'
  screens (e.g. one profile completing a chore updates another profile's
  view live).
- **Auth**: JWT (`golang-jwt/jwt/v5`) + bcrypt implementing the two-tier
  household/profile session model described above — one household-account
  session, then a lighter profile-switch session layered on top.
- **Docker**, a single multi-stage Dockerfile that cross-compiles the Go
  binary for amd64 + arm64 — a lot of the self-hosted audience runs on
  Raspberry Pi or ARM NAS boxes. Keep the image and runtime footprint light;
  avoid dependencies that only ship prebuilt binaries for x86.
- Migrations are GORM `AutoMigrate` only, run automatically at server boot —
  no separate migration-generation step. After editing
  `backend/internal/models/models.go`, AutoMigrate handles new
  columns/tables automatically at next boot.

## Conventions

- Backend: prefer small, focused handlers; keep business logic in
  `backend/internal/services`, not in the HTTP handlers themselves.
- Frontend: co-locate API calls under `frontend/src/api`; keep components
  small and focused, lifting shared state into context/TanStack Query
  rather than prop-drilling.
- No abstraction for a single call site. No config/feature-flag scaffolding
  for hypothetical future options. Three similar lines beat a premature
  helper.
- Before calling a feature done: run `cd backend && go build ./... && go vet
  ./...` and `cd frontend && npm run build && npm run lint`. There's no test
  suite yet — don't add one speculatively; add tests when there's logic
  worth protecting (e.g. recurrence-date calculation), not for CRUD
  boilerplate.
- Keep the Docker image and `docker-compose.yml` in sync with any new
  required environment variables (update `.env.example` too).

## Subagents

Not set up yet — there isn't enough codebase structure to divide up
profitably. Revisit once the core data model, auth, and chore CRUD exist;
likely candidates at that point are a schema/migrations owner and leaning on
the existing `code-review` skill for review passes, rather than a large
fixed agent roster.
