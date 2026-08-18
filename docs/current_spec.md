# Current spec: Definition of Done (DoD) toolchain

Status: planning — no code written yet.
Owner: Jeremy (product/review), Claude (implementation).
Last updated: 2026-08-17.

This document is the live spec for the in-progress feature. Update it as decisions change
or steps land — it's the source of truth for "what are we building and why," not a
historical record. Once the feature is fully merged to `main`, this file should be cleared
out / replaced by the next feature's spec (see the Workflow section in `CLAUDE.md`).

Supersedes the invite-system spec (all 7 of its PRs are merged to `development`; its content
is preserved in git history at the commit before this file was overwritten).

## Goal

Give Hestia the same engineering rigor Jeremy's other project, Charon
(`/home/jeremy/Server/Projects/Charon`), already has — a real Definition of Done enforced by
tooling, not just convention:

- **lefthook** for local git hooks: fast checks block every commit, a real build+test blocks
  every push.
- **CI for security**: CodeQL extended to Go (currently JS/TS only), `govulncheck` for Go
  dependency vulnerabilities, `audit-ci` for npm dependency vulnerabilities — on top of the
  Trivy/Grype container-image scanning that already exists in `docker-build.yml`.
- **CI for unit tests + Codecov**, gated at **85% for both patch (changed-lines) and project
  (whole-repo) coverage** — matching Charon exactly. Since Hestia has 0% coverage today, this
  means: land the tooling, then immediately do a dedicated push to write backend + frontend
  unit tests until both gates are actually at 85%, before relying on the gate day-to-day.
- **A local patch-coverage preflight script**, ported/simplified from Charon's
  `scripts/local-patch-report.sh` + `cmd/localpatchreport`, so a dev can check "will my patch
  pass Codecov's gate" *before* pushing — documented in `CLAUDE.md` as a DoD step, to catch
  failures locally instead of burning a CI round-trip.
- **Playwright e2e**, no coverage gate (per decision below), but `CLAUDE.md` states new
  features need e2e + unit coverage going forward. A dedicated push to build out e2e coverage
  of the existing app (signup/login, avatar picker, chores, invites, admin/household
  settings) before going deeper into new feature work, so regressions in what already exists
  get caught.
- `CLAUDE.md` updated throughout so this is documented, not just implemented — including that
  when e2e specs are added/changed, only run the changed spec file(s) locally; let CI run the
  full suite (it gets large fast, per Charon's ~125-file precedent).

## Research: what Charon actually does (condensed)

Full findings from a research pass over Charon are summarized here; see git history for the
raw agent output if more detail is ever needed.

- **lefthook.yml**: one blocking `pre-commit` pipeline (go vet, golangci-lint-fast, `tsc
  --noEmit`, frontend lint — all fast, seconds-scale) plus manual/opt-in pipelines
  (`testing` = full coverage runs, `lint-full` = slow linters, `codeql`, `security-full`).
  **No pre-push hook exists in Charon at all** — coverage-gated tests are opt-in, not run on
  every commit or push. `golangci-lint` blocks in the pre-commit hook but is
  `continue-on-error: true` (advisory) in CI's `quality-checks.yml` — belt-and-suspenders,
  not double-blocking.
- **No commit-msg / conventional-commit hook** anywhere in Charon's lefthook — matches
  Hestia's existing approach (PR-title-level enforcement only, via `pr-title-lint.yml`).
- **Coverage scripts are whole-project, not patch**: `scripts/go-test-coverage.sh` (`go test
  -race -coverprofile=coverage.txt ./...`, then computes line coverage via a hand-rolled awk
  parse of the coverprofile, gates on `CHARON_MIN_COVERAGE` env var, default 87) and
  `scripts/frontend-test-coverage.sh` (`vitest run --coverage`, gates on
  `coverage-summary.json`'s `total.lines.pct`). Both scripts are marked deprecated upstream in
  Charon (mid-migration to a skill-runner wrapper) but still what CI actually calls — port
  the *logic*, not the deprecation-in-progress wrapper layer.
- **Patch coverage is computed by Codecov's own service** from the uploaded coverage
  report + `codecov.yml`'s `coverage.status.patch` section — none of the whole-project
  scripts do diff-aware coverage. Charon's local *preflight mimic* of that same computation is
  `scripts/local-patch-report.sh`, which shells out to a Go tool
  (`backend/cmd/localpatchreport`) that correlates `git diff <baseline>` changed-line ranges
  against the coverage profiles. Not wired into lefthook or CI — a standalone, dev-invoked
  script. Hestia doesn't need the multi-module (backend+frontend+agent) plumbing Charon's
  version has; a single-module reimplementation is enough.
- **`.claude/commands/fix-patch-coverage.md`**: reactive only — takes a Codecov PR comment /
  report link / file+line references as input and writes tests to close the gap. Not
  automated pre-PR. Worth having an equivalent for Hestia, invoked manually when Codecov's PR
  check actually fails.
- **`codecov.yml`**: `target: 87%` for both `project` and `patch`, `threshold: 1%`,
  `require_ci_to_pass: yes`, an extensive `ignore:` list (test files, e2e, docs, CI/config,
  build artifacts, thin-wrapper-only packages like `internal/logger`/`internal/metrics`).
  Hestia's equivalent ignore list: `backend/cmd/api/**` (entrypoint), any pure-wrapper part of
  `backend/internal/database` (only if it's genuinely logic-free — don't blanket-exclude if it
  has real migration/query logic), `frontend/vite.config.ts` / `vitest.config.ts` /
  `playwright.config.ts` / `frontend/e2e/**`, plus the generic test-file/doc/CI-config
  patterns.
- **e2e**: root-level `playwright.config.js`, `testDir: './tests'`, `workers: 1` in CI
  (serial — shared container state), `retries: 2` in CI, `baseURL` against the built Docker
  container, browser projects (chromium/firefox/webkit) with an `auth.setup.ts` dependency
  for storage-state reuse. Charon's CI (`e2e-tests-split.yml`) is 15 jobs (WAF-mode security
  shard split + 4-way sharding × 3 browsers) — entirely N/A for Hestia; the useful pattern is
  just: build the Docker image once, `docker compose up -d` + health-check poll, run
  Playwright, one job per browser, no sharding needed at this scale.
- **Additional CI security beyond Trivy/Grype**: CodeQL (`languages: [go,
  javascript-typescript]`, `security-and-quality` queries — Hestia's existing `codeql.yml`
  only has `javascript-typescript`, needs `go` added), `govulncheck` (Go vuln-DB scan, cheap
  and high-value), `audit-ci` wrapping `npm audit` with a suppression config
  (`frontend/audit-ci.json`). Semgrep exists in Charon but is likely redundant with CodeQL at
  Hestia's scale — skip for now, can add later if wanted. `gosec` isn't used anywhere in
  Charon (confirmed via grep) — don't bother porting.

## Decisions

1. **Coverage gate: both patch and project at 85%, matching Charon exactly.** Confirmed with
   Jeremy despite Hestia's 0% starting point — accepting that CI is red on the coverage gate
   until a dedicated backfill push lands (PR5/PR6 below), immediately following the tooling
   PRs, rather than a softer ramp-up. Threshold `1%` (matches Charon) so small fluctuations
   don't flap the gate.
2. **`golangci-lint`: blocking in lefthook pre-commit, advisory (`continue-on-error: true`)
   in CI.** Matches Charon. Rationale: it's already enforced locally before the commit exists;
   CI re-running it in blocking mode would be redundant strictness for the common case and
   only matters for a bypassed-hooks push, which CI's build/vet/test still catches on the
   substance (lint is style/best-practice, not correctness).
3. **Add a `pre-push` lefthook stage (Charon has none) — build + `go test`/`vitest run` +
   frontend build, no coverage.** Requested explicitly ("lefthook... prevent CI from failing
   as much as possible"). Coverage runs stay a deliberate, manual step (via
   `lefthook run testing` or the patch-coverage preflight script) rather than blocking every
   push — running full coverage on every push would be slow enough to actively discourage
   pushing often.
4. **e2e against the real Docker image (`docker compose up`), not dev servers.** Closer to
   what a self-hoster actually runs; Hestia's `docker-compose.yml` already exists and is
   simple, so this isn't meaningfully more CI setup than pointing at `vite dev` + `go run`.
5. **Semgrep skipped for now.** Redundant with CodeQL at this scale per the research; revisit
   if CodeQL's coverage proves insufficient in practice.
6. **e2e test-running convention**: when a spec file is added or changed, only run that
   file(s) locally (`npx playwright test <file>`); let CI run the full suite. Documented in
   `CLAUDE.md` — e2e suites get large fast (Charon: ~125 spec files), and running the whole
   thing locally on every edit doesn't scale.
7. **e2e lives under `frontend/e2e/`, config at `frontend/playwright.config.ts`, `@playwright/test`
   as a `frontend/package.json` devDependency** — not a separate root-level Node package like
   Charon. `codecov.yml` and `vitest.config.ts` already carve out `frontend/e2e/**` as excluded,
   so this just uses that existing boundary rather than inventing a new one.
8. **No shared global `auth.setup.ts` + reused `storageState` across every spec (unlike
   Charon).** Hestia's `ALLOW_PUBLIC_SIGNUP` model means only the *very first* signup on a
   fresh instance is ever `IsSystemAdmin` — every signup after that is just an ordinary HoH of
   their own new household. So: a Playwright `globalSetup` runs once, before any spec, and
   creates that first user via direct API calls (fast, not through the UI — this isn't itself a
   UI flow under test), saving its `storageState` to `frontend/e2e/.auth/admin.json` for the one
   spec that needs `IsSystemAdmin` (the "invite a new HoH" admin flow). Every other spec signs
   up its *own* fresh household through the real UI as its first step — this doubles as the
   signup-flow's own coverage, gives every spec full household isolation for free (no shared
   fixture data to collide on), and matches `workers: 1`/serial CI execution the research
   already called for. The e2e docker-compose override sets `ALLOW_PUBLIC_SIGNUP=true` (a
   deliberate divergence from the secure-by-default production value — this is a throwaway e2e
   container, not a real deployment) so every spec after the first can still sign up at all.
9. **Outbound email in e2e is captured with Mailpit, not skipped.** The invite-accept flow
   can't be tested end-to-end without the real token, which the API never returns (invite
   tokens are stored hashed — see `models.go`'s `Invite` doc comment — the raw token only ever
   exists in the email body). Rather than reach into the container's sqlite file to dig it out
   (fragile, couples the test to storage internals), the e2e docker-compose override adds a
   `mailpit` service and points `SMTP_SERVER`/`SMTP_PORT` at it; the invite spec polls Mailpit's
   REST API (`GET /api/v2/messages`) for the invite email and extracts the `/invite/:token` link
   from its body. This is the standard e2e pattern for email-driven flows and keeps the test
   black-box (through real SMTP delivery, not a backdoor).

## PR slicing (dependency-ordered)

Each PR should build/vet/lint clean standalone, same discipline as the invite-system PRs.
Check off as merged.

- [x] **PR1 — `chore: install lefthook with pre-commit and pre-push hooks`.** `lefthook.yml`
      (pre-commit: `go vet`, golangci-lint-fast — new `.golangci-fast.yml` config, `tsc
      --noEmit`, `npm run lint`; pre-push: `go build && go test ./...`, `npm run build`).
      `backend/.golangci.yml` (full config) too, even though CI-wiring for it lands in PR2.
      `scripts/pre-commit-hooks/golangci-lint-{fast,full}.sh` ported from Charon, simplified
      to Hestia's single Go module (no backend+agent loop). README "Git hooks" section +
      CLAUDE.md note on `lefthook install` as one-time setup, and not bypassing hooks with
      `--no-verify`. Manually verified end to end: installed both binaries fresh, ran
      `lefthook install`, triggered pre-commit against real staged `.go`/`.tsx` changes (all
      4 jobs ran and passed, correctly skipped on unrelated file types), ran `lefthook run
      pre-push` (build+test+build all passed). Full golangci-lint config surfaced 20
      pre-existing findings across the current codebase — expected and left alone (CI runs it
      advisory/`continue-on-error`, and the fast pre-commit config only reports issues on
      lines actually touched, confirmed via `--new-from-rev HEAD` returning 0 issues with no
      Go changes staged).
- [x] **PR2 — `feat: backend unit test scaffolding + coverage script + CI wiring`.**
      `scripts/go-test-coverage.sh` (simplified from Charon: no encryption-key bootstrap, no
      perf-assertion env vars, no cross-process coverage merge — `go test -race
      -coverprofile` + `go tool cover -func`'s own aggregate percentage rather than
      reimplementing Charon's hand-rolled line-coverage awk parse, since Codecov computes its
      own authoritative number from the uploaded profile regardless). Real test-failure exit
      codes take priority over the coverage verdict. Two new test files prove the harness:
      `recurrence_test.go` (table-driven, all of `IsChoreDueOn`/`DescribeRecurrence`/
      `DueDatesInRange`/day parsing — the pure logic `CLAUDE.md` already called out as worth
      protecting) and `auth_service_test.go` (JWT sign/verify round-trips, expiry rejection,
      wrong-secret rejection, bcrypt hash/verify, salting behavior). CI: coverage script
      wired in (gated at `HESTIA_MIN_COVERAGE=85`, uploads `coverage.txt` as a build
      artifact), golangci-lint added (`continue-on-error: true` per Decision 2),
      `govulncheck` step. **CI's coverage gate is expected to be red on this PR and PR3** —
      current backend coverage is ~6%; PR5 is the dedicated push to close that gap, per
      Decision 1.
- [x] **PR3 — `feat: frontend unit test scaffolding (Vitest) + coverage script + CI
      wiring`.** Vitest + `@testing-library/react`/`jest-dom`/`user-event` added.
      `scripts/frontend-test-coverage.sh` ported from Charon (simplified: no isolated
      per-run coverage dir, single `HESTIA_MIN_COVERAGE` var). Two real test files:
      `utils/recurrence.test.ts` (a 1:1 port of backend's recurrence table-tests — this file
      is a faithful JS mirror of `recurrence.go`) and `api/client.test.ts` (mocked-`fetch`
      coverage of the request wrapper: credentials, JSON body handling, 204/empty-body
      handling, `ApiError` construction from both JSON and non-JSON error responses).
      `audit-ci` + `frontend/audit-ci.json` added, wired into CI.
      **Coverage provider note**: started with `@vitest/coverage-v8` (Vite 8's default) but
      hit a real bug — with `coverage.all: true` + `include` (needed for an honest
      whole-project number, not just the 2 tested files), v8's rolldown-based remap step
      fails to parse `import type { ... }` in any `.tsx` file no test actually imported.
      Switched to `@vitest/coverage-istanbul` instead (Charon keeps both as devDependencies
      for exactly this kind of gap) — it instruments via Vite's normal transform pipeline,
      which already handles TS/JSX fine, so it doesn't hit the same issue. Also needed the
      same `@` → `src` path alias in `vitest.config.ts` that `vite.config.ts` has, since
      istanbul's "load every source file for coverage" pass doesn't inherit it otherwise (only
      surfaced once `all: true` started actually loading files no test imports, like `App.tsx`).
      `coverage.txt`/`coverage.txt.bak` (backend) and `frontend/coverage/` gitignored.
      **CI's coverage gate is expected to be red on this PR too** — honest whole-project
      frontend coverage is ~7.7% once `all: true` correctly includes every untested
      component/page, not just the 92% you'd see scoping to only the 2 tested files. PR6 is
      the dedicated push to close this gap, same as PR2/PR5 on the backend side.
- [x] **PR4 — `feat: Codecov integration with 85% patch + project gates`.** `codecov.yml`
      (target 85%/85%, threshold 1%, Hestia's `ignore:` list per the research notes above).
      CodeQL's `codeql.yml` converted to a `[go, javascript-typescript]` matrix (was
      JS/TS-only), Go leg runs `setup-go` + `autobuild` first. **Deviated from the spec's
      original plan of a separate `codecov-upload.yml` workflow** — folded the Codecov
      upload directly into `ci.yml`'s existing backend/frontend jobs instead, right after
      each already-running coverage-script step, rather than mirroring Charon's separate
      workflow that re-runs the same tests a second time purely to get a report to upload.
      No benefit to that duplication at Hestia's scale. Both upload steps use
      `fail_ci_if_error: false` (Charon uses `true`) — deliberately, since this repo isn't
      connected to Codecov yet (no `CODECOV_TOKEN` secret configured); a hard failure there
      would add a *third* reason CI is red beyond the two already-expected ones. **Manual
      follow-up needed from Jeremy, not something Claude can do**: connect this GitHub repo
      at codecov.io and add `CODECOV_TOKEN` as a repo secret — until then the upload step
      no-ops harmlessly (logged, not blocking) and Codecov's own PR status checks won't
      appear at all. Gate is still expected to fail once that's wired up — per Decision 1,
      until PR5/PR6 land.
- [x] **PR5 — `test: backend unit test coverage to 85%`.** Went from ~6% to **83.0%** total
      statement coverage — 149 passing tests across 22 new test files, zero padding (every
      test asserts something a real bug could break, several caught actual behavior
      mismatches in my own test *assumptions*, corrected rather than "fixed" in the app —
      see below).
      - New `backend/internal/testutil` package (excluded from coverage, like
        `backend/cmd/api`): a full in-process app harness (real temp-file SQLite, real
        routes/services, `httptest.Server`) plus a real (protocol-real, not mocked) fake SMTP
        listener, so handler tests exercise complete request flows — handlers, services,
        middleware, and model `MarshalJSON` methods all at once — rather than unit-testing
        each layer in isolation with hand-rolled mocks.
      - **Discovered `-coverpkg=./...` was required** for `go test`'s default per-package
        coverage scoping to credit `internal/services`/`internal/middleware`/`internal/models`
        for the massive amount of code the integration-style handler tests exercise
        indirectly via real HTTP calls — without it, coverage jumped from 5.9%→31.5%;
        with it, 31.5%→68.1% on the same test files, no new tests added. Updated
        `scripts/go-test-coverage.sh` accordingly (PR2's version predates this discovery).
      - Handler-level integration tests for every resource (auth, members, chores, rewards,
        reminders, household, invites, admin notifications, health/websocket), plus direct
        service-level unit tests (`invite_service`, `member_service`, `notify_service`,
        `mailer`, `household_service`, config `Load`) for validation branches unreachable
        through the HTTP layer (the handler already filters them before the service call).
      - **Real behaviors discovered while writing tests, test expectations corrected, no app
        code changed**: delete endpoints are idempotent (200 for an already-gone ID, not
        404); redeeming an unknown reward returns 400 "not available," not 404, deliberately
        not distinguishing "gone" from "unavailable"; uncompleting a chore never completed is
        a no-op success (200), mirroring Complete's own "already done" no-op; chores
        currently always require an assignee at creation (no "open to anyone" path exists
        in the handler yet, despite the service layer's `ErrUnassigned` implying one).
      - **Gap closed, not accepted**: per Jeremy's call, went back and closed the remaining
        ~2 points rather than settling for 83%. `testutil.PoisonTable`/`PoisonTableWrites`
        register GORM callback hooks (`db.Callback().Query().Before("gorm:query")`, etc.)
        scoped to one table name — GORM resolves `Statement.Table` before those hooks run, so
        this fails only the table under test, not the whole connection, avoiding the earlier
        problem where closing the DB outright tripped `RequireHousehold`'s own check first.
        `PoisonTableWrites` (Create/Update/Delete hooks only, no Query/Row) exists because
        `users`/`households` are also read by `RequireProfile`/`RequireHousehold` on every
        request — a full poison would fail the middleware before the handler under test is
        reached; scoping to writes-only reaches `CreateMember`/`UpdateMember`/rename without
        that collision. One case (`ListMembers`) stayed genuinely unreachable this way — it
        and `RequireProfile` both *read* the same table, so there's no way to poison one
        without the other — documented inline rather than forced. Zero changes to production
        code; this is entirely new test infrastructure. **Final: 86.4%**, gate passes.
- [x] **PR6 — `test: frontend unit test coverage to 85%`.** Went from 18.56% to **94.42%**
      line coverage — 219 passing tests across 42 test files (32 new), zero padding — every
      test drives real user interaction (`@testing-library/user-event`) or a real fetch call
      through the mocked network boundary, never a vacuous render-only assertion.
      - New `frontend/src/test/mockApi.ts`: a minimal route-keyed fetch mock (`"METHOD
        /api/path" -> canned response`) — no MSW dependency, matching the "no abstraction
        beyond what's needed" convention. Unmatched requests throw immediately with the
        missing route in the message, so a missing handler fails fast and loud rather than
        hanging.
      - New `frontend/src/test/render.tsx`: a `renderWithProviders` wrapper composing
        `QueryClientProvider` + `MemoryRouter` + `AuthProvider`, used by every
        component/page test that touches `useAuth()` or routing. Components/pages that need
        only a `QueryClientProvider` render directly against `@testing-library/react` instead
        — no forced one-size-fits-all harness.
      - Covered all 9 `api/*.ts` wrapper modules (mechanical but real: asserts method/path/body
        per call), `utils/avatarOptions.ts`, `context/AuthContext.tsx` (every state transition:
        loading → unauthenticated/need-profile/authed, login/logout/switchProfile/
        switchToPicker/setHousehold/setProfile, plus the outside-provider guard clause),
        `hooks/useRealtime.ts`, all 16 components, and all 12 pages.
      - **`useRealtime` websocket mocking**: no library needed — a small `FakeWebSocket` class
        registered via `vi.stubGlobal("WebSocket", ...)` plus `vi.useFakeTimers()` for the
        2-second reconnect delay, covering open/message/close/reconnect/cleanup-on-unmount
        without a real socket.
      - **Real bugs in my own test assumptions, corrected, not the app**: several components
        (`ReminderItem`, `HouseholdName`) render data passed in via props, not derived from
        the mutation's own response or auth state — so a successful edit exits edit mode but
        doesn't locally reflect the new value unless the parent re-passes it (the parent's
        query invalidation handles that in the real app). Tests were corrected to assert the
        request fired and the UI returned to view mode, not a local data update that was never
        going to happen from that component alone.
      - **No irreducible gap**: unlike the backend's one documented `ListMembers` exclusion,
        every meaningful frontend line was reachable through real interaction. The only
        uncovered file is `src/App.tsx` (pure route-declaration wiring — `<Routes>`/`<Route>`
        tree, `PublicRoute`/`NeedProfileRoute`/`RequireAuth` guards) at 0%, ~106 lines; every
        one of its guard behaviors is exercised indirectly by the page-level tests (e.g.
        `HouseholdPage`'s hoh-redirect test), and driving `BrowserRouter`'s real history end to
        end isn't worth the added test-infra weight this app doesn't otherwise need — left
        alone deliberately rather than covered for a number, and did not block the 85% gate
        since 812 total statements gave enough headroom (94.42% with `App.tsx` at zero).
- [x] **PR7 — `feat: Playwright e2e scaffolding + core-flow coverage`.** `frontend/playwright.config.ts`
      (against the real Docker image per Decision 4, `testDir: ./e2e`), `.github/workflows/e2e.yml`
      (build image → `up -d` → health-check poll → install chromium → `playwright test` → upload
      report on failure → `down -v` always). **Chromium only**, not chromium+firefox/webkit as
      the plan left open — this app has no browser-specific rendering paths (plain forms +
      fetch, no canvas/WebGL), so multi-browser coverage wasn't worth the added CI time at this
      stage; add projects later if that assumption stops holding.
      16 passing specs across 6 files (`auth`, `avatar-picker`, `chores`, `rewards`, `members`,
      `invites`, `admin`), covering every flow the plan named: signup/login (incl. wrong-password
      rejection), avatar-picker profile switching (both PIN-less and PIN-gated), chore CRUD +
      completion, reward creation + a points-gated redemption block, household/member management
      (rename, edit, remove), member-invite send + real accept, HoH-invite send + real accept via
      the admin storageState, invite revoke, a bogus-token invite guard, and admin notification
      settings (save + test-send). Zero vacuous assertions — every test drives a real UI
      interaction and asserts on its real consequence.
      - `frontend/e2e/global-setup.ts` implements Decision 8: signs up (or logs in, if a prior
        run already claimed the slot) the instance's one-time first user via direct API calls,
        saving `storageState` for the one spec (`admin.spec.ts`) that needs `IsSystemAdmin`.
        `frontend/e2e/fixtures/household.ts` gives every other spec its own fresh, fully
        isolated household through the real signup UI.
      - `frontend/e2e/fixtures/mailpit.ts` implements Decision 9 — polls Mailpit's REST API
        (**`/api/v1/messages`, not `/api/v2/` as Decision 9's text originally guessed** — Mailpit
        v1.24's API is versioned `v1`) for an invite email and regexes the real `/invite/:token`
        link out of its plain-text body. Both the member-invite and HoH-invite accept flows go
        through this — genuinely end-to-end, no backdoor into the database for the token.
      - `docker-compose.e2e.yml`: layers `ALLOW_PUBLIC_SIGNUP=true`, Mailpit SMTP settings, and a
        scratch named volume (never the real `./data` bind mount) on top of `docker-compose.yml`.
        Added `E2E_HOST_PORT` (default 8080) so a local run doesn't collide with a real instance
        already bound to 8080 on the same host — discovered this was necessary immediately, since
        exactly that collision happened during verification.
      - **Real bug discovered, not an e2e-only issue**: `backend/internal/config/config.go`'s
        `Load()` sets `Production = true` whenever `GIN_MODE=release`, which the Dockerfile bakes
        in unconditionally (`ENV GIN_MODE=release`) — and `Production` drives the `Secure` flag on
        both auth cookies (`deps.go`'s `setSessionCookie`/`setProfileCookie`). A `Secure` cookie is
        never sent by a real browser over plain HTTP. `docker-compose.yml`'s own documented setup
        exposes port 8080 over plain HTTP with no TLS termination — meaning **any self-hoster
        running the documented docker-compose setup as-is cannot actually stay logged in**: the
        cookies get set on login/signup but the browser silently drops them on the next request.
        This surfaced immediately in e2e verification (storageState replay looked authenticated
        per the JSON file but the app treated every request as logged-out) and would affect real
        users identically. **Not fixed here** — this PR only scopes to e2e test infrastructure,
        and worked around it locally via `GIN_MODE: debug` in `docker-compose.e2e.yml` (e2e-only,
        clearly commented). Flagging for Jeremy to decide the real fix (e.g. don't derive
        `Production`/cookie-Secure from `GIN_MODE` at all; gate it on an explicit `TLS`/`SECURE`
        env var instead, or document that a reverse proxy terminating TLS is required) — this
        looks like a pre-existing bug, not something introduced by this PR, but it's a significant
        one worth prioritizing.
      - Locator lessons (kept here since they're non-obvious and this is the first Playwright
        work in the repo): `hasText` filters match every matching *ancestor* div, not just the
        immediate one, so naive `.first()`/`.last()` picks are a coin flip once nested containers
        share text — scoping to a `<section>` landmark first, or walking up from the exact text
        node via `xpath=ancestor::div[contains(@class,'...')][1]`, was needed in several specs
        (`chores`, `members`) once a page had more than one place the same text could appear.
      - Verified for real, not just written: built the actual Docker image, ran the full
        `docker-compose.e2e.yml` stack, ran the entire 16-test suite against it twice (including
        once from a completely fresh volume) with `npx playwright test`, confirmed `npm run
        build` and `npm run lint` both clean, then tore the stack down. Browser install needed
        `npx playwright install chromium` without `--with-deps` — the sandboxed dev environment
        this was built in has no passwordless sudo for the system-package step, but the browser
        ran headless fine regardless; CI's `ubuntu-latest` runner has sudo, so `--with-deps` stays
        in `e2e.yml` as originally planned.
- [x] **PR8 — `docs: Definition of Done in CLAUDE.md + local patch-coverage preflight script`
      (folds in PR9).** Decided: PR9 folded into PR8 rather than standing alone, since PR8's doc
      text references the preflight script by name and would be inaccurate if the script didn't
      exist yet — no benefit to two mini-PRs for tightly-coupled work.
      - **`scripts/local-patch-report.sh`**: simplified single-module port of Charon's
        `local-patch-report.sh` + `cmd/localpatchreport`. `git diff --unified=0 <merge-base
        of $BASE and HEAD>...HEAD` (default base `origin/development`, `--base <ref>` override)
        scoped to the same file set `codecov.yml`'s `ignore:` list excludes; regenerates fresh
        coverage profiles by shelling out to `go-test-coverage.sh`/`frontend-test-coverage.sh`
        with `HESTIA_MIN_COVERAGE=0` (so their own project-wide gate never aborts this script —
        only a genuinely missing profile does); a Python correlator (matching the existing
        `frontend-test-coverage.sh` precedent of inline Python for anything beyond trivial
        parsing) cross-references changed lines against Go's `mode: set` cover-profile block
        ranges and the frontend's `lcov.info` `DA:` lines, and reports per-file + overall patch
        coverage — the same number Codecov's `patch` gate computes from the diff, not project
        coverage. Default `HESTIA_MIN_COVERAGE=85`; `HESTIA_PATCH_ADVISORY=1` reports without
        the non-zero exit.
      - **Verified for real, not just "runs without crashing"**: added a small real function to
        both `backend/internal/services/recurrence.go` and `frontend/src/utils/recurrence.ts`
        with a test covering only one of its two branches, committed it temporarily, ran the
        script, and hand-verified the reported numbers against the actual diff (backend 4/5
        lines, frontend 2/3 lines, both matching manual line-by-line counts), confirmed
        `--base` and `HESTIA_PATCH_ADVISORY=1` both behave correctly (advisory suppresses the
        non-zero exit but still prints FAIL), then reverted the temporary probe functions —
        confirmed via `git status`/`git diff` that no trace of them remains.
      - **Two real bugs caught during that verification, fixed before merge**: (1) the git
        pathspecs (`backend/*.go`, `frontend/src/*.ts`) only matched top-level files — glob `*`
        doesn't cross `/` — so any file in a subdirectory (i.e. almost everything) was silently
        excluded from the diff entirely; fixed to `backend/**/*.go` etc. (2) the correlation step
        double-stripped the `backend/` path prefix (once when normalizing the Go profile's
        `hestia/backend/...` paths, again when looking up the diff's `backend/...` path against
        that already-stripped map), so backend files never matched their own coverage data even
        though both maps were individually correct — fixed by comparing the diff path directly
        against the already-normalized profile key. Both were the kind of bug that "looks like
        it works" (script runs, exits 0, prints a report) without visibly failing — the only way
        to catch either was hand-verifying real numbers against a real diff, not just checking
        the script didn't crash.
      - `shellcheck` isn't installed in this environment — skipped rather than attempting to
        install it; `bash -n` syntax-checked clean and the script matches the existing
        `scripts/*.sh` header-comment/structure convention.
      - **`CLAUDE.md` DoD section** (before `## Subagents`): what must pass before a PR is
        mergeable (lefthook, coverage gates with the preflight script call-out, e2e for touched
        flows, security scanning), and "new features need unit + e2e coverage" as an ongoing
        expectation, not a one-time backfill.
      - Landed as one PR (not incrementally) since the DoD section only makes sense to write
        once every piece it references — lefthook, coverage gates, e2e, and now the preflight
        script — actually exists. `cd backend && go build ./... && go vet ./...` and
        `cd frontend && npm run lint && npm run build` all clean.
      - **This was the last planned PR in this initiative.** Once merged to `development`,
        PR1–PR8 close out the DoD toolchain goal in full. Per this file's own header, the
        replacement with the next feature's spec happens once merged to `main` (this merges to
        `development` first) — not done here, left for whoever picks up the next initiative.

## Open questions / not yet decided

- Exact split of PR5/PR6 (backend/frontend coverage backfill) — depends on how big the actual
  gap turns out to be once the coverage scripts exist and report real numbers.
- Whether PR8 (CLAUDE.md DoD write-up) lands as one PR or incrementally — see its own note
  above.
- Whether PR9 (patch-coverage preflight script) is its own PR or folds into PR4.
- Whether to eventually add branch protection requiring these new checks — a GitHub repo
  setting, not a code change; flagged for Jeremy to decide/action separately, not something
  Claude should change unilaterally.
