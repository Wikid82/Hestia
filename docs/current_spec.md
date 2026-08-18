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

## PR slicing (dependency-ordered)

Each PR should build/vet/lint clean standalone, same discipline as the invite-system PRs.
Check off as merged.

- [ ] **PR1 — `chore: install lefthook with pre-commit and pre-push hooks`.** `lefthook.yml`
      (pre-commit: `go vet`, golangci-lint-fast — new `.golangci-fast.yml` config, `tsc
      --noEmit`, `npm run lint`; pre-push: `go build`, `go test ./...`, `npm run build`). A
      `.golangci.yml` (full config) too, even though CI-wiring for it lands in PR2. README/
      CLAUDE.md note on `lefthook install` as a one-time setup step for a fresh clone.
- [ ] **PR2 — `feat: backend unit test scaffolding + coverage script + CI wiring`.**
      `scripts/go-test-coverage.sh` (simplified from Charon: no encryption-key bootstrap, no
      perf-assertion env vars, no cross-process coverage merge — just `go test -coverprofile`
      + line-coverage computation), a handful of real unit tests proving the harness works
      (recurrence-date calculation is the obvious first target per `CLAUDE.md`'s own existing
      "add tests when there's logic worth protecting" note), golangci-lint added to CI
      (`continue-on-error: true` per Decision 2), `govulncheck` step.
- [ ] **PR3 — `feat: frontend unit test scaffolding (Vitest) + coverage script + CI
      wiring`.** Vitest + `@testing-library/react` (or similar) added to `frontend/`, a
      handful of real tests, `scripts/frontend-test-coverage.sh` (simplified from Charon),
      `audit-ci` + `frontend/audit-ci.json` added to CI.
- [ ] **PR4 — `feat: Codecov integration with 85% patch + project gates`.** `codecov.yml`
      (target 85%/85%, threshold 1%, Hestia's `ignore:` list per the research notes above),
      new `codecov-upload.yml` workflow (backend + frontend flags), CodeQL's `codeql.yml`
      extended to include `go` in its language matrix. Gate will initially fail — expected,
      per Decision 1 — until PR5/PR6 land.
- [ ] **PR5 — `test: backend unit test coverage to 85%`.** Bulk test-writing pass across
      `backend/internal/services` and `backend/internal/api/handlers` until project coverage
      hits the gate. Likely the largest PR in this initiative; may get split further once the
      actual gap is known (run the coverage script first to see where the gaps are before
      committing to a specific sub-slice plan).
- [ ] **PR6 — `test: frontend unit test coverage to 85%`.** Same idea, frontend side —
      components, hooks, `api/*` modules.
- [ ] **PR7 — `feat: Playwright e2e scaffolding + core-flow coverage`.** `playwright.config.ts`
      (against the real Docker image per Decision 4), a new e2e CI workflow (build image once,
      one job per browser — chromium at minimum, firefox/webkit if time allows — no sharding),
      and an initial spec set covering the app's core flows as they exist today: signup/login,
      avatar-picker/profile-switch, chore CRUD + completion, reward redemption, member
      management, invite send/accept, admin notification settings. This is the "cover as much
      of the code as possible before going deeper" pass the goal section calls for.
- [ ] **PR8 — `docs: Definition of Done in CLAUDE.md`.** Consolidates everything above into a
      DoD section in `CLAUDE.md`: what must pass before a PR is mergeable (lefthook clean,
      unit + patch coverage ≥85%, e2e passing for touched flows), when to run the local
      patch-coverage preflight script and how, the "new/changed e2e spec runs locally, full
      suite runs in CI" convention, and "new features need unit + e2e coverage" as an ongoing
      expectation, not just a one-time backfill. (Could land incrementally alongside each PR
      above instead of as one final PR, similar to how PR7 wrapped up the invite-system docs —
      decide based on how much actually accumulates.)
- [ ] **PR9 (maybe) — `feat: local patch-coverage preflight script`.** Simplified port of
      Charon's `local-patch-report.sh` + `cmd/localpatchreport` — single-module (no
      backend+frontend+agent multi-report plumbing needed), diffs against `origin/development`
      by default, computes patch coverage from freshly-generated coverage profiles, exits
      non-zero if below 85% (advisory mode available via a flag/env var). Could fold into PR4
      instead of standing alone — decide once PR4's actual scope is clearer.

## Open questions / not yet decided

- Exact split of PR5/PR6 (backend/frontend coverage backfill) — depends on how big the actual
  gap turns out to be once the coverage scripts exist and report real numbers.
- Whether PR8 (CLAUDE.md DoD write-up) lands as one PR or incrementally — see its own note
  above.
- Whether PR9 (patch-coverage preflight script) is its own PR or folds into PR4.
- Whether to eventually add branch protection requiring these new checks — a GitHub repo
  setting, not a code change; flagged for Jeremy to decide/action separately, not something
  Claude should change unilaterally.
