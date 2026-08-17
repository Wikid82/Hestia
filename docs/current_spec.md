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
- [ ] **PR4 — `feat: invite data model and accept flow (backend)`.**
      `Invite` model/service (token hashed at rest, expiry, revoke),
      endpoints for system-admin-issues-HoH-invite and
      hoh-issues-member-invite, public token-validate + accept endpoints,
      `ALLOW_PUBLIC_SIGNUP` gate on the existing `/auth/signup` route
      (default false — see Decision 5), sends email via PR2, fires
      notification via PR3.
- [ ] **PR5 — `feat: invite UI (send + accept)`.** Admin "invite a HoH"
      screen, household "invite a member" screen (with the existing
      no-email managed-profile path called out as the alternative), public
      `/invite/:token` accept page, pending-invites list with
      revoke/resend.
- [ ] **PR6 — `feat: self-serve password set/change on existing
      profiles`.** Lets a managed (no-login) profile be upgraded to
      email+password later, and lets any self-login user change their own
      password. Independently useful outside the invite flow.
- [ ] **PR7 — `docs: multi-household/invite model, env vars, security
      rationale`.** README, `.env.example`, CLAUDE.md updates explaining
      the SMTP-env-var and closed-by-default-signup decisions so they
      aren't re-litigated later.

## Open questions / not yet decided

- Exact `Invite` token format/length and hashing scheme (leaning:
  crypto/rand 32-byte token, sha256 hash stored, raw token only ever in
  the emailed link).
- Invite expiry window (leaning: 7 days, matching nothing in particular —
  open to input).
- Whether a HoH invite that's never accepted should be listable/revocable
  by any system admin or only the one who sent it (leaning: any system
  admin, since they're all equally "the instance owner").
