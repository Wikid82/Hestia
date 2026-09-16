# Hestia docs site

Built with [Docusaurus](https://docusaurus.io/). Published to GitHub Pages
by `.github/workflows/docs.yml` on every push to `main` that touches this
directory.

```bash
npm install
npm start      # local dev server with hot reload
npm run build  # production build to ./build, what the workflow deploys
```

Content lives in `docs/` — see `sidebars.ts` for page order. Per
[`CLAUDE.md`](../CLAUDE.md)'s Definition of Done, these pages should be
updated in the same PR as any user-facing change, not as a follow-up.
