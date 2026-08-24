# Current spec: Forgot/reset password

Status: planning — no code written yet.
Owner: Jeremy (product/review), Claude (implementation).
Last updated: 2026-08-18.

This document is the live spec for the in-progress feature. Update it as decisions change
or steps land — it's the source of truth for "what are we building and why," not a
historical record. Once the feature is fully merged to `main`, this file should be cleared
out / replaced by the next feature's spec (see the Workflow section in `CLAUDE.md`).

Supersedes the DoD-toolchain spec (all 8 of its PRs are merged to `development`, not yet
synced to `main` — that's just pending a routine `development`→`main` promotion, not blocking
new work; its content is preserved in git history at the commit before this file was
overwritten).

## Why

Jeremy got locked out of his own test account after a rebuild. Investigation (see session,
not repeated here) confirmed it's *not* a bug — the account and bcrypt hash in the DB are
intact and well-formed; the password saved in his password manager just doesn't match. There
was no way to recover short of a direct DB edit, which he declined in favor of building the
real feature. Every real deployment needs this regardless of how this particular lockout
happened.

## Goal

Self-service "forgot password" for any profile that has email/password login (i.e. has
`PasswordHash` set — managed/PIN-only profiles have no email and are out of scope, same as
they're already out of scope for the existing self-serve password-set flow from PR #70).

## Key decisions

1. **Mirror the existing `Invite` token pattern exactly**, rather than inventing a new
   scheme: a random 32-byte token, stored only as its sha256 hash (`PasswordReset` model,
   parallel to `Invite`), raw token only ever in the email link + the moment-of-creation
   response. Reuses `Mailer`/`BaseURL` already wired up for invites. Rationale: it's already
   reviewed, tested infrastructure in this codebase; no reason to design a second pattern for
   the same problem shape.
2. **Short expiry: 1 hour** (vs. invites' 7 days). A password reset is a "I need in right
   now" action, not a slow-burn onboarding link — a stolen/leaked reset-request email is also
   a more immediate account-takeover risk than a stolen invite link, so keep the window tight.
3. **No email enumeration.** `POST /api/auth/forgot-password` always returns `200` with a
   generic "if that email exists, a reset link was sent" message, regardless of whether the
   email matches an account — same reasoning as the existing generic "invalid email or
   password" login error (`Login` handler already deliberately doesn't distinguish
   not-found-email from wrong-password). If SMTP isn't configured, still return 200 (don't
   leak configuration state to an unauthenticated caller) but log server-side, and the
   `Mailer.IsConfigured()` check happens up front the same as invites do — the difference is
   invites are HoH/system-admin-only (safe to tell them "email isn't configured"), while
   forgot-password is public and unauthenticated (must not leak anything either way).
4. **Creating a new reset token supersedes any prior pending one for that user** — mirrors
   `CreateInvite`'s "any still-pending invite for the same scope is revoked" behavior, so
   requesting a new link invalidates an old one instead of leaving multiple valid links live.
5. **Successful reset invalidates the token (single-use) and does not auto-login.** Unlike
   `AcceptInvite` (which logs the invitee straight in since they have no prior session), a
   password reset happens to an *existing* account — safer to send them to the normal login
   page with their new password than to silently authenticate whoever holds the reset link.
6. **Successful reset does not force-logout other active sessions.** Hestia's JWT sessions
   aren't tracked server-side (no session table to revoke against — same tradeoff already
   accepted for the existing session model), so this is a pre-existing limitation, not
   something new. Out of scope to fix here; worth a future note if session revocation is ever
   added.
7. **Frontend**: two new pages, `ForgotPasswordPage` (`/forgot-password`, email input, reuses
   the generic-success copy) and `ResetPasswordPage` (`/reset-password/:token`, new-password
   input, same password-length validation as signup/invite-accept). `LoginPage` gets a
   "Forgot password?" link. Both public routes, same tier as `/invite/:token`.

## API surface

- `POST /api/auth/forgot-password` `{email}` → always `200 {"ok": true}`. No auth required.
- `POST /api/auth/reset-password` `{token, password}` → `200 {"ok": true}` on success;
  `400` for expired/already-used/malformed token or password < 8 chars (matches existing
  validation elsewhere); generic error, no distinction between "not found" and "expired" in
  the response body (avoids confirming token validity to a caller probing tokens) — mirrors
  how `AcceptInvite` *does* distinguish those in its own errors, but that's a difference
  because invite tokens are handed out by a trusted HoH/admin to a known invitee, while reset
  tokens are requested anonymously — see Decision 3's same reasoning.

## PR slicing

- [x] **PR1 — `feat: password reset backend (model, service, endpoints)`.** `PasswordReset`
      model in `models.go` (mirrors `Invite`: `ID`, `UserID`, `TokenHash`, `ExpiresAt`,
      `UsedAt *time.Time`, `CreatedAt`). `PasswordResetService` (`CreateReset`, `Reset`)
      parallel to `InviteService`. `POST /api/auth/forgot-password` + `POST
      /api/auth/reset-password` handlers in `auth.go`, wired into `Deps`/`main.go`/
      `testutil/app.go`/`routes.go`. Unit tests for the service (expiry, single-use,
      superseding a prior pending reset, unknown-email/managed-profile no-op, DB-error
      propagation via `testutil.PoisonTable`) and handler-level integration tests (success,
      wrong/old password after reset, missing fields, SMTP-unconfigured still returns a
      generic 200, unexpected-DB-error 500 via `PoisonTableWrites`). Added
      `testutil.Options.SMTPUnconfigured` and `testutil.LastPasswordResetToken` to support
      these. Patch coverage 90.0% (gate: 85%). `go build`/`go vet`/`golangci-lint-fast`/full
      test suite all clean.
- [ ] **PR2 — `feat: forgot/reset password UI`.** `ForgotPasswordPage`,
      `ResetPasswordPage`, `api/auth.ts` additions, routes in `App.tsx`, "Forgot password?"
      link on `LoginPage`. Unit tests for both pages (mirrors `InviteAcceptPage.test.tsx`
      style: submit, error states, success state).
- [x] **PR3 — `test: e2e coverage for forgot/reset password flow`.** New
      `frontend/e2e/password-reset.spec.ts` (2 specs: full request-link → reset → login-with-
      new-password flow, and a bogus-token error case) plus `findPasswordResetLink` added to
      `frontend/e2e/fixtures/mailpit.ts`, mirroring `findInviteLink`'s existing pattern
      exactly. **Not run locally** — see the incident note below; verification relies on CI
      (`.github/workflows/e2e.yml`) running it in a clean runner. `npx eslint` on the new
      files is clean.
      - **Incident during this PR, not caused by the spec's own code**: running
        `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d` to verify the
        spec locally recreated Jeremy's real, already-running `hestia` container — his actual
        deployment is *also* managed from this same checkout, via a local
        (gitignored) `docker-compose.override.yml` that layers on top of the same
        `docker-compose.yml`, using the same `container_name: hestia`. The e2e override
        shares that name (only its own `container_name: hestia-e2e` differs, but Compose
        matched the base service first), so `up` reconfigured the running container onto the
        e2e port/volume, and the subsequent `down` removed it. Real household data on disk
        (bind-mounted from `/home/jeremy/Server/Configs/containers/theshelter/hestia`) was
        never touched and confirmed intact; the container itself was restored with a plain
        `docker compose up -d` (which auto-loads the override) and verified (mounts, port
        3300, health check, user row all back to normal) — about 90 seconds of downtime, no
        data loss. **Follow-up worth doing, not done here**: `docker-compose.e2e.yml`'s
        container name collision with a real deployment sharing this checkout is a real
        footgun for anyone (including future Claude sessions) running e2e locally against a
        repo that's also serving a live instance — worth a docs note or a more defensively
        distinct e2e container/project name, flagged for Jeremy rather than changed
        unilaterally mid-feature.

## Open questions / not yet decided

- None currently — flag here if scope questions come up during implementation.
