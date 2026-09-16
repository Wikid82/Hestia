# Current spec: Docs site (GitHub Pages) + Definition of Done doc requirement

Status: planning — no code written yet.
Owner: Jeremy (product/review), Claude (implementation).
Last updated: 2026-09-16.

This document is the live spec for the in-progress feature. Update it as decisions change
or steps land — it's the source of truth for "what are we building and why," not a
historical record. Once the feature is fully merged to `main`, this file should be cleared
out / replaced by the next feature's spec (see the Workflow section in `CLAUDE.md`).

Supersedes the Web Push notifications spec — that feature is fully merged to `development`
(PR #113, `feat: Web Push notifications (#39)`, covers all 5 commits), so this file is
correctly free to move on to the next initiative.

## Why

Part of an SEO push for the project (discussed in-session, not a numbered GitHub issue):
fixed stale/misleading GitHub topics, tightened the repo description, and sharpened README
positioning already landed directly (small doc edits, no spec needed for those). What's left
needs its own spec because it's genuinely multi-PR: a published docs site is one of the two
highest-value SEO levers available (external aggregators like awesome-selfhosted are the
other, and out of scope here — that's a submission action, not something to build), and right
now there's no docs site at all, just README + CLAUDE.md.

Two things ship under this spec:
1. A docs site built with Docusaurus, published to GitHub Pages via a new workflow.
2. Initial doc content: index/home, quick start, features, troubleshooting, FAQ — the
   standard set for a self-hosted OSS project (structure informed by
   https://www.atlassian.com/blog/loom/software-documentation-best-practices — audience-first
   structure, task-oriented quick start, searchable/scannable pages).
3. A `CLAUDE.md` Definition of Done update requiring docs to be created/updated as part of
   normal feature work going forward, so this doesn't stay a one-time push.

## Key decisions

1. **Docusaurus**, not MkDocs Material or VitePress or plain Jekyll markdown. Asked Jeremy
   directly since a new docs framework is a real external-dependency decision per
   `CLAUDE.md`. Chosen because it's React-based (matches the existing frontend stack, no new
   language/toolchain the way MkDocs' Python would be), has strong SEO defaults out of the
   box (sitemap.xml, per-page meta tags, `docusaurus-plugin-sitemap` built in), built-in
   search, and is the most common choice among comparable self-hosted OSS projects, so
   contributors/tooling familiarity is higher than VitePress.
2. **Lives in `docs-site/` at repo root, separate from `docs/`.** `docs/` already holds
   internal working docs (`current_spec.md`, `environment.md`) that are *not* meant to be
   published verbatim as end-user-facing site content — they're written for
   Jeremy/Claude-session context, not site visitors. Docusaurus's own convention is to keep
   its Markdown content in a `docs/` subfolder *of the site project*, so nesting Hestia's
   existing `docs/` inside a new `docs-site/docs/` would be confusing; a sibling directory
   keeps the split clean. `docs-site/docs/` holds the published content authored under this
   spec (index, quick-start, features, troubleshooting, FAQ).
3. **Publish via `gh-pages` branch + `actions/deploy-pages`** (the standard GitHub Pages
   Actions flow: build → upload artifact → deploy), triggered on push to `main` when
   `docs-site/**` changes. Per `CLAUDE.md`, `.github/workflows/*` changes land directly on
   `main` (not through a `development` PR) since that's the branch Actions actually runs
   from; `propagate-main-to-development.yml` carries the workflow file back down
   automatically.
4. **GitHub Pages custom domain: not configured in this spec.** No domain has been decided:
   defer to the default `wikid82.github.io/Hestia` URL for now; revisit if/when a domain is
   picked, at which point `docs-site/static/CNAME` and the `homepageUrl` repo setting both
   need updating together.
5. **`CLAUDE.md` Definition of Done gets a new bullet**: any PR that adds/changes
   user-facing behavior must update the relevant `docs-site/docs/*` page(s) in the same PR,
   the same way tests are already required in the same PR rather than as a follow-up. Applies
   going forward to new feature work — not retroactively backfilling docs for every past
   merged feature in this same spec (that would be its own large undertaking with its own
   spec if pursued).

## Doc content scope (this spec's PR2)

Structure per the Atlassian article's recommended shape — audience-first, scannable,
task-oriented:
- **Index/home** — what Hestia is, who it's for, links out to the sections below. Doubles as
  the SEO landing page (title/meta description should reuse the README's "why Hestia"
  language for consistency).
- **Quick start** — the fastest path to a running instance: `docker compose up`, first-signup
  flow, add a household member, create a chore. Task-oriented, not a feature tour.
- **Features** — the planned-v1 feature list from the README, expanded with enough detail to
  be genuinely useful (multi-household, roles, invites, recurring chores, points/streaks),
  not just a restatement of the README bullets.
- **Troubleshooting** — common self-hoster friction: port conflicts, env var misconfiguration
  (missing `BASE_URL`/SMTP), Docker volume/permissions issues, "first signup didn't get
  admin" type questions. Content seeded from what's plausible given `docs/environment.md` and
  the Docker setup; will need real user reports over time to fill in more.
- **FAQ** — positioning questions ("how is this different from Sweepy," "does this need an
  account/cloud service," "can multiple families share one instance") plus licensing/data
  ownership questions self-hosters commonly ask.

Content is necessarily a first pass — accurate to the current early-stage app (per the
README's own "Status: early days" framing), not aspirational marketing copy. Where a feature
is planned but not yet built, the docs should say so rather than imply it already works.

## PR / commit slicing

One feature, one PR against `development` for everything except the workflow file itself —
`.github/workflows/*` is the one carve-out `CLAUDE.md` already documents as landing directly
on `main` (since that's the branch Actions runs from; `propagate-main-to-development.yml`
carries it back down). Everything else — Docusaurus scaffold, real content, `CLAUDE.md`
update — is commit-sliced within one branch/PR, not split into separate PRs per step.

- **`feat/docs-site` branch, one PR against `development`** (commits, not separate PRs):
  1. Docusaurus scaffold (`npx create-docusaurus@latest docs-site classic --typescript`),
     default tutorial content stripped out.
  2. Real content for the five pages (index, quick start, features, troubleshooting, FAQ)
     per the content scope above.
  3. `CLAUDE.md` Definition of Done + Conventions update requiring docs stay current with
     user-facing changes going forward.
  Verify locally with `npm run build` inside `docs-site/` before opening the PR — the GitHub
  Pages workflow (below) is what actually publishes it, not this PR by itself.
- **Direct commit to `main`, `ci:` prefix — GitHub Pages workflow.**
  `.github/workflows/docs.yml`: triggers on push to `main` when `docs-site/**` or the
  workflow file itself changes, plus `workflow_dispatch` for manual re-runs; steps are
  `npm ci` + `npm run build` inside `docs-site/`, then `actions/upload-pages-artifact` +
  `actions/deploy-pages`. Enable Pages in repo settings (source: GitHub Actions, not a
  branch) as part of this rollout. This will sit dormant (no `docs-site/` to build yet) until
  the `feat/docs-site` PR merges to `development` and a subsequent `development` → `main`
  sync brings the directory over — that's expected, not a bug to chase.
