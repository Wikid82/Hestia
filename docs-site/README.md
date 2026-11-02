# Hestia docs site

Built with [Zensical](https://zensical.org/), a static site generator from the
creators of Material for MkDocs. Published to GitHub Pages by
`.github/workflows/docs.yml` on every push to `main` that touches this
directory.

This is Python docs tooling only; the app itself is Go + React. Zensical is
pinned exactly in `requirements.txt` and bumped by Renovate.

```bash
python3 -m venv .venv                 # optional, keeps the install local
. .venv/bin/activate
pip install -r requirements.txt
zensical serve                        # local dev server with live reload
zensical build --strict               # production build to ./site, what the workflow deploys
```

Content lives in `docs/`. Page order and the top navigation are set explicitly
in `zensical.toml` (`nav`). Theme colors and layout tweaks live in
`docs/assets/stylesheets/custom.css`; the logo and favicon are in
`docs/assets/images/`. Zensical only copies static files from `docs/`, so
assets must live there.

`--strict` fails the build on broken internal links and anchors, so keep
cross-page links (e.g. `./features.md#roles`) valid when renaming headings.

Per [`CLAUDE.md`](../CLAUDE.md)'s Definition of Done, these pages should be
updated in the same PR as any user-facing change, not as a follow-up.
