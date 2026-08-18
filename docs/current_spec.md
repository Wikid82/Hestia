# Current spec: user invite system

Status: planning — no code written yet.
Owner: Jeremy (product/review), Claude (implementation).
Last updated: 2026-08-17.

This document is the live spec for the in-progress feature. Update it as
decisions change or steps land — it's the source of truth for "what are we
building and why," not a historical record. Once the feature is fully
merged to `main`, this file should be cleared out / replaced by the next
feature's spec (see the Workflow section in `CLAUDE.md`).

## Goal

A self-hoster (system admin) can invite other people to use their Hestia
instance without sharing one login:

- Invite someone as a **HoH (Head of Household)** who gets their own,
  fully independent household — e.g. inviting a friend who doesn't want to
  self-host but wants to run their own family's chore chart on your
  instance, with zero visibility into your household or vice versa.
- A HoH (or system admin, within their own household) can invite regular
  **members** of their household by email, who set their own password on
  accept instead of sharing the household's one login.
- The existing no-email **managed profile** path (kid with no email
  address, switch-only avatar, optional PIN) stays exactly as it is today
  — invites are additive, not a replacement.
- The admin/HoH who sent an invite gets notified when it's accepted.

## Current state (as of this spec)

- One household ↔ many `User` profiles. `POST /auth/signup` creates a
  household plus its one login-capable `User` (`Role: admin`) in the same
  call. All other profiles are switch-only, no email/password.
- Two-tier session already exists: `hestia_session` (household JWT) +
  `hestia_profile` (profile JWT). Middleware chain: `RequireHousehold` →
  `RequireProfile` → `RequireAdmin`.
- `HouseholdAuthService.Login` already queries `User` by email across the
  whole table (not household-scoped), and `PasswordHash` is already a
  per-`User` column, just unset for managed profiles. This means "every
  user can have their own password" is mostly wiring, not a new backend
  auth mechanism.
- Nothing exists yet for: multi-household administration, invites, SMTP,
  outbound notifications, or a system-wide admin distinct from a
  household's owner.

## Decisions

1. **Role split, two orthogonal axes, not three tiers on one axis.**
   - `User.Role`: `hoh | member` (rename today's `admin` value to `hoh` —
     same permissions as today, scoped to one household).
   - `User.IsSystemAdmin bool`: new, platform-wide, independent of
     household. Grants cross-household admin (invite HoHs, see every
     household, manage instance-wide settings).
   - A fresh self-hoster's first signup gets both (`hoh` of their own
     household + `IsSystemAdmin: true`) — preserves today's behavior for
     a single-household instance exactly.
   - Boot-time backfill (idempotent code alongside `AutoMigrate`, not a
     real migration system): any existing `Role: admin` row becomes
     `Role: hoh, IsSystemAdmin: true` so upgraders keep access.

2. **SMTP config: environment variables only, never DB/web UI.**
   Rationale: SMTP credentials are a secret for an *external* system and
   would have to be stored reversibly if editable at runtime — a new class
   of secret sitting in the same sqlite file the README tells people to
   "just copy to back up," plus new API surface that could leak it.
   `AUTH_SECRET` already sets the precedent of "fail fast at boot if
   unset." `BASE_URL` (needed to build invite links) follows the same
   env-only pattern for the same reason.

3. **Notification-channel config (Discord/ntfy/webhook/etc.): DB-backed,
   editable in the web UI, system-admin-only.** Lower stakes than SMTP
   (a leaked webhook URL lets someone post fake notifications, not access
   an external account), and benefits from no-redeploy editability.

4. **Notification scope for v1: notify the inviter when their invite is
   accepted.** No per-user notification preferences — one system-wide
   channel config is enough. Don't build a preferences system nobody has
   asked for yet.

5. **Public self-signup: `ALLOW_PUBLIC_SIGNUP` env var, default `false`.**
   There are zero real users of this app yet (pre-launch), so default to
   closed: nobody should be able to spin up a household on someone else's
   found instance without being invited. An instance owner opts in
   explicitly by setting it to `true`; once they do, the security
   implications of open signup on their instance are theirs to own, not
   ours. `AUTH_SECRET`-style fail-fast doesn't apply here since it's a
   boolean toggle, not a missing-required-secret case — unset means
   closed.

## PR slicing (dependency-ordered)

Each PR should build/vet/lint clean standalone. Check off as merged.

- [x] **PR1 — `feat: split admin into system-admin and household-owner
      (hoh) roles`.** Model rename + `IsSystemAdmin`, boot-time backfill,
      `RequireAdmin` → `RequireHoH` + new `RequireSystemAdmin` middleware,
      frontend role-string updates. Pure foundation, no new user-facing
      feature.
- [x] **PR2 — `feat: SMTP config and mailer service`.** Env vars
      (`BASE_URL`, `SMTP_HOST/PORT/USER/PASS/FROM/TLS`), fail-fast
      validation, `mailer.go` (net/smtp), `.env.example`/
      `docker-compose.yml` updates. Inert until PR4 uses it.
- [x] **PR3 — `feat: wire go_notify_yourself for admin notifications`.**
      Added `github.com/Wikid82/go_notify_yourself`, DB-backed
      `NotificationSettings`, `notify_service.go` wrapper, system-admin
      settings endpoints (`GET/PUT /api/admin/notification-settings`,
      `POST .../test`), frontend `/admin` settings page. Scoped to the
      seven HTTP-webhook-style providers (Discord, Slack, Gotify,
      Pushover, ntfy, Telegram, generic webhook) — deliberately not the
      module's "email" provider, since it wants an HTML-capable Mailer
      and `services.Mailer` (PR2) is plain-text only; invite email itself
      goes straight through `services.Mailer`, not through notify. Nobody
      calls `NotifyService.Notify` yet — that lands with the invite
      accept flow in PR4.
- [x] **PR4 — `feat: invite data model and accept flow (backend)`.**
      `models.Invite` (raw token sha256-hashed at rest, 7-day expiry,
      status pending/accepted/revoked, expiry computed on read rather
      than stored). `services.InviteService`: create (auto-revokes any
      still-pending invite for the same email+household scope), public
      preview by token, accept (creates the household+hoh or member
      profile, logs the invitee straight in), list, revoke
      (household-scoped for a HoH, unscoped for a system admin — any
      system admin can revoke any hoh invite, resolving the spec's open
      question). New endpoints: `POST/GET /api/admin/invites` +
      `DELETE .../:id` (system-admin, hoh invites), `POST/GET
      /api/members/invites` + `DELETE .../:id` (HoH, member invites for
      their own household), public `GET /api/invites/:token` (preview)
      and `POST /api/invites/:token/accept`. `ALLOW_PUBLIC_SIGNUP` gate
      added to `POST /auth/signup` (default false, per Decision 5 — the
      very first signup on a fresh instance always succeeds regardless,
      so bootstrapping still works out of the box). Invite creation
      requires SMTP to be configured (PR2) and fires an
      `invite.accepted` notification on accept (PR3). No frontend yet —
      that's PR5.
- [x] **PR5 — `feat: invite UI (send + accept)`.** Admin "Invite a Head
      of Household" section on `/admin` (email form + pending-invites
      list with revoke), household "Invite a member by email" section on
      `/household` alongside the existing no-email "Add a family member"
      form (each now has explanatory copy on when to use which), public
      `/invite/:token` accept page (shows household context for member
      invites, collects a household name for hoh invites, logs the
      invitee straight in via a new `acceptInvite` AuthContext action).
      No separate "resend" endpoint — re-inviting the same email just
      calls create again, which the backend already supersedes.
- [x] **PR6 — `feat: self-serve password set/change on existing
      profiles`.** Two endpoints: `PATCH /api/members/me/credentials`
      (self-service — any active profile can set/change its own
      email+password; requires `currentPassword` only if one is already
      set) and `PATCH /api/members/:id/credentials` (HoH-only admin
      override — sets/resets another member's login, no current password
      needed). New `/account` page + nav link for every profile; new
      "Set up login" / "Reset login" action in `MemberCard`'s edit mode
      for HoH-managed members. Also fixed a latent bug this PR would
      otherwise have made reachable: `MemberService.Delete` used to key
      "undeletable" off "has a password set" (fine when only the founding
      account ever had one) — now that any member can get a login, that
      check is instead "would this leave the household with zero HoHs,"
      which is the invariant that actually matters.
- [x] **PR7 — `docs: multi-household/invite model, env vars, security
      rationale`.** CLAUDE.md's "Product shape" section rewritten to
      describe the multi-household/HoH/system-admin model, per-profile
      auth, invites, and the SMTP-env-var-only /
      notification-settings-DB-backed / closed-by-default-signup
      rationale — this is now the permanent home for that reasoning,
      since this spec file gets cleared out once the feature reaches
      `main`. `.env.example` and `docker-compose.override.yml.example`
      updated to point at CLAUDE.md instead of this file, and to show an
      example of overriding SMTP/BASE_URL/ALLOW_PUBLIC_SIGNUP personally.
      README updated (multi-household in "Planned features", a new
      paragraph on invites/email setup in the Docker section). Decided
      against adding a duplicate docker-compose.yml block to the README —
      it would drift from the real file; the existing `git clone` +
      `docker compose up -d` flow already uses the canonical file, and
      the override-file pattern covers the "how do I customize this"
      need without a second source of truth.
      **Revised**: on reflection, `.env.example` inline rationale essays
      didn't scale — added `docs/environment.md` as the single exhaustive
      reference (every var: default, every option, Docker-Compose-
      applicable or not) and cut `.env.example` down to a lean,
      fully-commented-out pointer file. Every other pointer (CLAUDE.md
      Conventions, `docker-compose.yml`/`docker-compose.override.yml*`
      comments, backend doc comments in `config.go`/
      `household_auth_service.go`/`models.go`) updated to match: `.env.example`
      → `docs/environment.md` for "what does this var do," CLAUDE.md's
      "Product shape" for "why is it designed this way." CLAUDE.md's
      Conventions section now requires updating both `.env.example` and
      `docs/environment.md` together whenever an env var changes.

## Open questions / not yet decided

All resolved as of PR4 — see that entry above. (Token: crypto/rand
32-byte, sha256 hash stored, raw token only ever in the emailed link and
the create-invite API response. Expiry: 7 days. Revoke scope: any system
admin can revoke any hoh invite.)
