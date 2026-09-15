# Current spec: Web Push notifications (issue #39)

Status: planning — no code written yet.
Owner: Jeremy (product/review), Claude (implementation).
Last updated: 2026-09-14.

This document is the live spec for the in-progress feature. Update it as decisions change
or steps land — it's the source of truth for "what are we building and why," not a
historical record. Once the feature is fully merged to `main`, this file should be cleared
out / replaced by the next feature's spec (see the Workflow section in `CLAUDE.md`).

Supersedes the forgot/reset-password spec — that feature is fully merged to `development`
(PR #82, `feat: forgot/reset password`, covers all 3 PRs including the UI), so this file is
correctly free to move on to the next feature.

## Why

`github.com/Wikid82/go_notify_yourself` (already a dependency, currently pinned at v0.2.2)
shipped a `webpush` provider in v0.3.0: direct RFC 8030/8291/8292 browser push delivery, no
third-party relay. This is the library-side prerequisite for GitHub issue #39, "Web Push
notifications" — installed-PWA push for chore-assigned/overdue and reward-approval events on
iOS 16.4+ Safari and Android Chrome, with no app store and no native wrapper.

## Important: this is a different concern from the existing `NotifyService`

`backend/internal/services/notify_service.go` already uses this same library (Discord,
Slack, Gotify, ntfy, Pushover, Telegram, generic webhook providers) — but that's a
**singleton, instance-wide, system-admin-facing** alert channel ("an invite was accepted"),
configured once by the system admin via `NotificationSettings`. Issue #39 is **per-user**:
each household member who opts in gets their own browser push subscription, targeted at
events relevant to *them* specifically (a chore assigned to them, their reward redemption
pending approval). These need separate models and a separate service — `NotifyService` isn't
extended, a new `PushService` sits alongside it. Both end up calling into the same
`go_notify_yourself` factory/transport machinery, just with different providers (`webhook`-
family vs. `webpush`) and different fan-out shape (one configured sender vs. one sender per
subscription per send).

## Blocking dependency: issue #32 (PWA foundation) is not started

Issue #39 explicitly depends on #32, and there's no PWA scaffolding in the repo yet — no
manifest, no service worker. This matters beyond "nice to have first": **Web Push cannot
function without a service worker** (there is no `push` event to listen for without one),
and iOS specifically requires the site to already be installed to the home screen before
`Notification`/`PushManager` permission requests are even honored. So PR1 below builds the
minimal service-worker/manifest subset #39 actually needs (registration, `push` and
`notificationclick` listeners, installability) rather than waiting on #32 to land separately
first. If #32 lands first for its own reasons (offline shell caching, full manifest/icon
polish), PR1 shrinks to just adding the push-related listeners to what's already there — flag
this to Jeremy if #32 starts before this spec's PR1 does, so the two don't duplicate a
service-worker file.

## Key decisions

1. **VAPID keypair: generated once, stored in the DB, not an env var.** This is the one
   place this spec deliberately deviates from the SMTP/`BASE_URL` "secrets for an external
   system are env-only" pattern in `CLAUDE.md` — and that's correct, not an oversight: a
   VAPID key doesn't authenticate this app *to* anything external. It's a self-generated
   identity that browsers pin a subscription to (`PushManager.subscribe({applicationServerKey})`),
   generated locally via `webpush.GenerateVAPIDKeyPair()`. Requiring a self-hoster to run a
   separate keygen step and set two more env vars just to get push working (vs. it working
   automatically the first time a user opts in) is worse UX for zero security benefit — and
   it needs to *persist* across restarts (rotating it invalidates every existing browser
   subscription per that function's own doc comment), so env-var-only would actually be worse
   than DB storage here, not more secure. New singleton model `PushConfig` (same pattern as
   `NotificationSettings`, fixed ID), lazily created on first subscribe attempt if it doesn't
   exist yet.
2. **VAPID subject reuses `BASE_URL`** (`"https://" + host from BASE_URL`) rather than adding
   a new env var or DB setting for an admin contact email. `BASE_URL` is already a required
   env var for real deployments (invite links need it) and RFC 8292 accepts an `https:` URI
   equally to `mailto:`. If `BASE_URL` isn't set, push subscription attempts fail with a clear
   error rather than silently using a placeholder — same "don't paper over missing config"
   instinct as the existing `Mailer.IsConfigured()` checks.
3. **Multiple subscriptions per user.** A `PushSubscription` row per (browser, device) a user
   has subscribed from — a parent checking chores from both their phone and a kitchen tablet
   should get pushes on both. Unique on `(UserID, Endpoint)`; re-subscribing the same
   endpoint (e.g. browser refreshed the subscription) upserts rather than duplicating.
4. **Dead subscriptions are pruned on send, not proactively.** Per the Web Push spec, a 404
   or 410 response from the push service's endpoint means the subscription is gone for good
   (uninstalled, permissions revoked, browser data cleared). `PushService.SendToUser` deletes
   the local row when it sees that response rather than leaving a permanently-dead row to
   retry forever — no background job needed, this falls out of the normal send path for
   free, consistent with the no-background-jobs constraint.
5. **"Chore overdue" push is deferred out of v1 — flagged as an open question below, not
   silently dropped.** "Assigned" and "reward pending approval" are real synchronous
   actions (`ChoreService.Create`/`Update` setting `AssignedToUserID`; #37's approval flow,
   itself unbuilt) that a push can hang directly off of, matching the issue's own proposed
   approach ("triggered synchronously from the action that causes them"). "Overdue" has no
   such action — a chore becomes overdue purely by the clock passing `DueDate`, which is
   exactly the shape of thing this codebase already computes on read (`Chore.CompletedToday`)
   rather than via a scheduler. See Open Questions for the tradeoff and a recommended
   opportunistic-on-read approach.
6. **No new env vars.** VAPID keys are DB-generated (decision 1) and the subject reuses
   `BASE_URL` (decision 2), so nothing new needs to land in `.env.example` /
   `docs/environment.md` for this feature.

## API surface

- `GET /api/push/vapid-public-key` — authenticated (any logged-in profile). Returns
  `{publicKey: string}`, lazily generating `PushConfig` if it doesn't exist yet. The
  frontend needs this before it can call `PushManager.subscribe`.
- `POST /api/push/subscribe` — authenticated. Body: `{endpoint, keys: {p256dh, auth}}`
  (the shape `PushSubscription.toJSON()` produces in the browser). Upserts a
  `PushSubscription` row for the current user.
- `POST /api/push/unsubscribe` — authenticated. Body: `{endpoint}`. Deletes the row if
  present; no-op (still `200`) if not — matches the idempotent-unsubscribe pattern elsewhere
  in this codebase (e.g. `AcceptInvite`-style "don't leak whether it existed" isn't the
  concern here, just ordinary idempotency).

## PR / commit slicing

One feature is one PR — the whole thing merges to `development` together, as a single
squash commit, once it clears the full Definition of Done bar (unit coverage, e2e, security
scanning). The steps below are **commits on one feature branch/PR (`feat/web-push-pwa-shell`,
currently open as PR #113)**, not separate PRs — nothing here merges on its own. PR #113's
title/description will be updated to describe the whole feature before it's ready, and it
stays open (not merged) until every step below is done.

- [x] **Commit 1 — PWA shell for Web Push (manifest + service worker).**
      `frontend/public/manifest.json` (name, icons, `display: standalone`, theme color) and
      `frontend/public/sw.js` (install/activate, `push` listener → `showNotification`,
      `notificationclick` listener → focus/open the relevant chore). Register the service
      worker from `main.tsx`. Scoped narrowly to what push needs — full offline-shell asset
      caching stays #32's scope if #32 gets its own pass later. Manual verification: "Add to
      Home Screen" on iOS Safari and Android Chrome, per #32's own acceptance criteria (no
      Lighthouse gate added here, that's #32's bar). Landed as commit e9b9e8e.
- [x] **Commit 2 — `deps: bump go_notify_yourself to v0.3.0` + VAPID config, push
      subscription model/service/endpoints.** Bump `go.mod` (this ships in the binary, so
      `deps:` per the commit-prefix convention, not `chore:` — note the *overall PR title*
      is still whatever `feat:`/`fix:` best summarizes the full feature, since only the PR
      title drives release-please; this is about the individual commit message). `PushConfig`
      singleton model (mirrors `NotificationSettings`), `PushSubscription` model (`ID`,
      `UserID` indexed, `Endpoint` uniqueIndex-with-UserID, `P256dh`, `Auth`, `CreatedAt`).
      `PushService` in `backend/internal/services`: `GetOrCreateVAPIDKeys`, `Subscribe`,
      `Unsubscribe`, `SendToUser(ctx, userID, title, body, data)` (loads all subscriptions
      for the user, builds one `webpush.Client` per subscription via the shared
      `transport.Wrapper` pattern `NotifyService` already establishes, sends to each, prunes
      on 404/410 per decision 4). Handlers + routes for the three endpoints above, wired into
      `Deps`/`main.go`/`testutil/app.go`/`routes.go` matching the existing service-wiring
      pattern. Unit tests: VAPID lazy-generation (and that it's stable across repeated
      calls), subscribe upsert, unsubscribe idempotency, `SendToUser` fan-out to multiple
      subscriptions, dead-subscription pruning on 404/410 (via a fake transport/mock
      `transport.Wrapper` target, not a real push service), `BASE_URL`-unset error path.
      Integration tests for the three handlers mirroring `notifications_test.go`'s style.
- [x] **Commit 3 — frontend push subscribe/unsubscribe flow.** A settings toggle (likely
      alongside wherever per-user preferences already live, or a new small "Notifications"
      section) that requests `Notification` permission, calls
      `navigator.serviceWorker.ready` → `pushManager.subscribe({applicationServerKey})`
      using the key from `GET /api/push/vapid-public-key`, and posts the resulting
      subscription to `POST /api/push/subscribe`. Unsubscribe path calls
      `pushManager.getSubscription()` → `.unsubscribe()` → `POST /api/push/unsubscribe`.
      `frontend/src/api/push.ts` for the fetch calls, unit tests for the component
      (permission granted/denied/dismissed states, subscribe success/error, unsubscribe).
- [x] **Commit 4 — send push on chore assignment.** Wire `PushService.SendToUser` into
      `ChoreService` at the point `AssignedToUserID` is set on create or changed on update
      (only when it's a real assignment change, not every edit) — title/body naming the
      chore, `data` carrying the chore ID so `notificationclick` (commit 1's service worker)
      can deep-link to it. Best-effort: a push failure must not fail the chore
      create/update request, same "optional side-channel, don't fail the primary action"
      posture `NotifyService.Notify` already takes for admin alerts. Unit tests: push fires
      on new assignment and on reassignment, does not fire on unrelated edits or
      unassignment, chore mutation still succeeds if `SendToUser` errors.
- [x] **Commit 5 — e2e coverage for push subscribe/unsubscribe.** Real push *delivery*
      isn't meaningfully testable in CI — it requires a live browser push service (FCM /
      Mozilla autopush) that a headless Playwright run in `docker-compose.e2e.yml` has no
      route to, and issue #39's own acceptance criteria ("works on iOS/Android") is
      inherently a manual, real-device check, not an automatable one. Scoped to what *is*
      real e2e-able: `frontend/e2e/push-notifications.spec.ts` grants the `notifications`
      permission, waits for the service worker to be ready, toggles the Account page's
      "Push notifications" checkbox on (asserting a real `POST /api/push/subscribe` round
      trip and a re-check-after-reload that it persisted) and off again (`POST
      /api/push/unsubscribe`). **Not run locally** — see the incident note below;
      verification relies on CI (`.github/workflows/e2e.yml`) running it in a clean runner.
      `npx eslint` and `tsc --noEmit` on the new file are clean. This was the last planned
      commit — PR #113 is now ready for the Definition of Done review pass (coverage gate,
      full CI, security scanning) and merge.
      - Turns out even *subscribing* isn't reachable from CI either — `PushManager.subscribe()`
        itself tries to register with the real push service over the network, which the
        runner can't reach, so the real call rejected and the checkbox silently reverted.
        Fixed by stubbing `PushManager.prototype.subscribe`/`getSubscription` via
        `addInitScript` (the spec still exercises the real UI and real
        `/api/push/subscribe`+`/api/push/unsubscribe` round trip against the real backend,
        just not real external push registration — already out of scope per this note).
        Also switched from Playwright's `.check()`/`.uncheck()` to `.click()` + an explicit
        `toBeChecked`/`not.toBeChecked` wait: those helpers expect the checkbox's native
        `checked` property to flip immediately off the click, but the enable/disable
        mutations here are multi-step async chains (permission request, VAPID fetch, service
        worker, subscribe/unsubscribe, backend POST) that don't resolve in time for that
        stricter check. Took 3 CI round-trips (with temporary console/response-URL logging,
        since the workflow's `playwright-report` artifact wasn't landing on failure — worth
        a follow-up look, not chased further here) to find both causes; e2e now passes
        cleanly.
      - **Near-incident during this commit, not caused by the spec's own code**: running
        `docker compose -f docker-compose.yml -f docker-compose.e2e.yml build` to verify the
        spec locally retagged the shared `hestia:latest` image with this branch's dev/e2e
        build — `docker-compose.yml` pins `image: hestia:latest` + `build: .`, and Compose's
        `build` (not just `up`) reassigns that tag regardless of which override files are
        also passed. This is the same class of footgun as PR3's incident in the (now
        superseded) forgot/reset-password spec, but triggered one step earlier (`build`
        rather than `up`) and this time nothing actually restarted — the real, already-
        running `hestia` container keeps executing from its original image layer regardless
        of what the tag now points to, so no downtime occurred. Caught before running `up`;
        recovered by re-tagging the real container's live image ID (`docker inspect hestia
        --format '{{.Image}}'`) back onto `hestia:latest`, confirmed via `docker inspect
        hestia --format '{{.State.Status}} {{.Image}}'` still showing the original SHA
        running. **Not fixed here, flagged for Jeremy**: `docker-compose.e2e.yml`'s own
        `name: hestia-e2e` project pin (added after PR3's incident) prevents `up`/`down` from
        touching the real container, but does nothing about `build` retagging the shared
        `hestia:latest` name — a real fix needs the e2e stack to build under its own image
        tag (e.g. `image: hestia:e2e` in `docker-compose.e2e.yml`, or an explicit `docker
        build -t hestia:e2e .` step) rather than relying on `docker-compose.yml`'s shared
        tag. Worth doing before the next person (including a future Claude session) runs
        `docker compose build` against this checkout.

## Open questions / not yet decided

- **"Chore overdue" push trigger.** No synchronous write-time action corresponds to a chore
  *becoming* overdue — it's a pure function of the clock vs. `DueDate`, computed on read
  today (`ChoreService` sets `Chore.CompletedToday` at query time, no persisted "state
  change" event exists to hang a push off of). Two real options:
  - **(a) Drop it from v1.** Ship "assigned" only (PR4) plus reward-approval-pending once
    #37 lands; note "overdue" as a fast-follow once there's a trigger point. Simplest, and
    #39's acceptance criteria only requires "at least one real event" to be satisfied.
  - **(b) Opportunistic-on-read.** Piggyback on an existing synchronous read endpoint
    (e.g. whenever any household member's client fetches the chores list — already
    happening constantly via TanStack Query polling/refetch) to notice chores that just
    crossed into overdue for the first time and weren't previously notified, then fire a
    push. Needs a new `Chore.OverdueNotifiedAt *time.Time` column to dedupe (so it fires
    once, not on every subsequent read) and reset it when the due date changes.
    Still "no background jobs" — the trigger is a read a client was already going to make —
    but it means overdue pushes only fire while *someone* in the household has the app
    open/polling, which is a real (if minor) gap for "app closed for days" cases.
  - **Recommendation: (a) for this PR slicing** — ship the clean synchronous case first,
    revisit (b) as its own small follow-up once "assigned" pushes are proven working
    end-to-end on real devices. Flagging rather than deciding unilaterally since it's a
    product tradeoff (timeliness vs. added complexity), not a pure implementation detail.
- **Where the subscribe/unsubscribe toggle lives in the UI** (dedicated "Notifications"
  settings section vs. folded into an existing profile/settings page) — deferred to PR3,
  not a blocking decision for the backend PRs.
