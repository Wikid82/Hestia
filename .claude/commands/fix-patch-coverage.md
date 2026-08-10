# Fix Patch Coverage

You are a senior test engineer. Close the gap to **85% patch coverage** (the
project's mandatory coverage gate — see `codecov.yml`) on the lines this
branch has actually changed, before it gets pushed.

## Input

$ARGUMENTS

(Optional: a specific baseline ref, a Codecov PR comment, or specific file +
line references like `src/lib/actions/chores.ts lines 45-48`. If empty, run
the full check below and work from its output.)

## Execution Protocol

### Phase 1: Get current patch coverage

```bash
npm run test:coverage
node scripts/check-patch-coverage.mjs
```

This runs the full suite with coverage, then diffs `coverage/lcov.info`
against the resolved baseline (the current branch's PR base if `gh` can see
one, else `origin/development`) to report per-file patch coverage and the
exact uncovered line numbers for lines this branch added or changed.

### Phase 2: Analyze uncovered lines

For each file listed with uncovered lines: read the source around those
lines, understand what triggers them (a validation branch, an error path, a
conditional render), and find the matching test file.

- Server logic (`src/lib/**`, `src/lib/actions/**`, `src/proxy.ts`): tests
  live alongside the source as `*.test.ts`, using the harness in
  `src/test/setup.ts` — a real in-memory SQLite db (migrated fresh per test
  file) plus mocks for `next/headers`, `next/cache`, and `next/navigation`.
  `redirect()` throws `Error("NEXT_REDIRECT:<path>")`; assert on that with
  `assert.rejects(fn(), /NEXT_REDIRECT:\/path/)`. Seed data directly via
  `db.insert(...)` and `createSession()`/`createProfileSession()` from
  `@/lib/auth/session`.
- Components (`src/app/**/*.tsx`, excluding `page.tsx`/`layout.tsx` which
  are intentionally uncovered — see below): tests live alongside the source
  as `*.test.tsx`, starting with a `// @vitest-environment jsdom` docblock
  (the project default is Node). Use `@testing-library/react` +
  `@testing-library/user-event` + vitest's `expect`. Mock any imported
  server action with `vi.mock("@/lib/actions/xxx", () => ({ actionName:
  vi.fn(async () => null) }))` — component tests never hit the real db.

If the uncovered lines are in a `page.tsx` or `layout.tsx` under `src/app/`,
or in `src/db/schema.ts`, `src/db/index.ts`, or `src/instrumentation.ts`,
**stop** — these are excluded from the coverage mandate on purpose (thin
route composition / declarative schema / process bootstrap, exercised by
`e2e/household-flow.spec.ts` instead). Don't add tests there; if the patch
script is still flagging them, its ignore list has drifted from
`codecov.yml`'s and needs fixing instead.

### Phase 3: Write tests

Follow the patterns above and the existing sibling `*.test.ts(x)` files in
the same directory as a template. Write targeted tests that:

- Exercise the specific uncovered lines/branches
- Verify real behavior (the assertion should fail if the logic were wrong,
  not just execute the line)
- Are deterministic and independent (each server-logic test creates its own
  household/user rows; don't rely on ordering or state from other tests)

### Phase 4: Validate

```bash
npm run test:coverage
node scripts/check-patch-coverage.mjs
npm run lint
```

Confirm patch coverage is now ≥85%, all tests pass, and lint is clean.

## Constraints

- **Do NOT relax the coverage threshold** in `vitest.config.ts` or
  `codecov.yml` — always close the actual gap.
- **Do NOT write tests that only exist to pad coverage** — every assertion
  should verify real behavior.
- **Do NOT modify production code** unless a genuine bug surfaces while
  writing a test — in that case fix it and call it out explicitly.
- **Do NOT create flaky tests** — no reliance on wall-clock time beyond what
  `src/lib/chores/recurrence.ts`'s own tests already do, no unhandled async
  races, no shared mutable state across tests.
