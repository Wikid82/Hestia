# Security Policy

## Supported Versions

Hestia is pre-1.0 — only the latest release gets security fixes.

| Version         | Supported          |
| --------------- | ------------------- |
| 0.x (latest)    | :white_check_mark:  |
| older 0.x       | :x:                  |

## Reporting a Vulnerability

Use [GitHub Private Security Advisories](https://github.com/Wikid82/hestia/security/advisories/new),
or open a [GitHub Issue](https://github.com/Wikid82/hestia/issues) for non-sensitive reports.

Please include a description, reproduction steps, impact assessment, and a non-destructive proof
of concept where possible. We'll acknowledge reports within a few days — this is a solo-maintained
project, not a company with an SLA.

---

## Known Vulnerabilities

Last reviewed: 2026-08-09

Every entry below is suppressed in CI via [`.trivyignore`](./.trivyignore) and
[`.grype.yaml`](./.grype.yaml), both scanned on every build (see
`.github/workflows/docker-build.yml`). Suppressions carry an expiry date; when one is reached,
it's re-checked against upstream rather than silently extended forever.

### [HIGH] CVE-2026-53615 · util-linux integer overflow (Debian base image)

| Field | Value |
|---|---|
| **Packages** | bsdutils, libblkid1, libmount1, libsmartcols1, libuuid1, mount, util-linux, util-linux-extra |
| **Severity** | High |
| **Status** | Awaiting upstream · review by 2026-09-20 |

Integer overflow/wraparound in the util-linux source package (all 8 listed binaries are built from
it). No patched Debian 12 (bookworm) package as of 2026-08-09.

**Why it's low-risk here**: the container's only running process is `node server.js` (see
Dockerfile `CMD`) — none of these binaries are ever invoked by Hestia's application code.

### [HIGH] CVE-2025-69720 · ncurses buffer overflow (Debian base image)

| Field | Value |
|---|---|
| **Packages** | libtinfo6, ncurses-base, ncurses-bin |
| **Severity** | High |
| **Status** | Awaiting upstream · review by 2026-09-20 |

No patched bookworm package as of 2026-08-09. Not invoked by Hestia's Node.js runtime.

### [HIGH] CVE-2026-41992 · gzip global buffer overflow (Debian base image)

| Field | Value |
|---|---|
| **Package** | gzip |
| **Severity** | High |
| **Status** | Awaiting upstream · review by 2026-09-20 |

No patched bookworm package as of 2026-08-09. Not invoked by Hestia's Node.js runtime.

### [HIGH] CVE-2026-54369 · libacl symlink traversal privilege escalation (Debian base image)

| Field | Value |
|---|---|
| **Package** | libacl1 |
| **Severity** | High |
| **Status** | Awaiting upstream · review by 2026-09-20 |

No patched bookworm package as of 2026-08-09. Not invoked by Hestia's Node.js runtime.

### [CRITICAL/HIGH] perl-base — 8 CVEs (Debian base image)

| Field | Value |
|---|---|
| **CVEs** | CVE-2026-13221, CVE-2026-42496, CVE-2026-57433, CVE-2026-8376 (Critical) · CVE-2026-42497, CVE-2026-48962, CVE-2026-57432, CVE-2026-9538 (High) |
| **Package** | perl-base |
| **Severity** | Critical / High |
| **Status** | Awaiting upstream · review by 2026-09-20 |

Perl core plus bundled-module vulnerabilities (Archive::Tar, Storable, IO::Compress). No patched
bookworm package as of 2026-08-09.

**Why it's low-risk here**: Hestia is a Node.js app. Perl is part of the Debian base image and is
never invoked at runtime — there's no code path that reaches it.

### [CRITICAL] CVE-2023-45853 · zlib integer overflow / heap buffer overflow (Debian base image)

| Field | Value |
|---|---|
| **Package** | zlib1g |
| **Severity** | Critical |
| **Status** | Awaiting upstream · review by 2026-09-20 |

No patched bookworm package as of 2026-08-09. Not directly invoked by Hestia's application code.

### [HIGH/CRITICAL] npm's own bundled tooling — 7 CVEs

| Field | Value |
|---|---|
| **CVEs** | CVE-2026-13149, CVE-2026-14257, CVE-2026-69152 (brace-expansion) · CVE-2026-69192 (ip-address) · CVE-2026-59873 (Critical), CVE-2026-59874 (tar) · CVE-2026-12151 (undici) |
| **Severity** | High, one Critical (CVE-2026-59873) |
| **Status** | **Planned fix (self-remediation)** · target 2026-08-23 |

**What**: `brace-expansion`, `tar`, `ip-address`, and `undici` all resolve to
`/usr/local/lib/node_modules/npm/node_modules/...` — confirmed by pulling the built image and
inspecting it directly. These are npm's *own* bundled dependencies, shipped because npm itself
comes pre-installed in the `node:24.19.0-slim` base image. They are not in Hestia's dependency
tree (`npm ls` finds none of them from the project root) and are absent from `/app/node_modules`,
the app's actual runtime directory.

**Why there's no upstream fix to wait on**: there is one, for the standalone packages
(`brace-expansion` ≥5.0.7/1.1.16/2.1.2, `tar` ≥7.5.18/7.5.19, `ip-address` ≥10.3.1, `undici`
≥6.27.0) — but Hestia doesn't control which versions npm bundles internally. Waiting on npm's own
upstream to bump its internal deps isn't a reliable timeline.

**Actual fix**: strip the bundled npm CLI from the Dockerfile's runtime stage — it's never invoked
there (`CMD` is `node server.js`), so removing it eliminates this entire category rather than
suppressing it indefinitely. Tracked for the 2026-08-23 review; if not done by then, extend the
suppression and note why.

---

## Review process

When a suppression's expiry date arrives:

1. Re-run the CVE/package through Trivy and Grype against the current base image.
2. Check whether Debian bookworm (for OS packages) or the relevant npm package (for the bundled
   tooling group) has shipped a fix.
3. If fixed: rebuild, confirm the finding is gone, remove the entry from `.trivyignore`,
   `.grype.yaml`, and this file in the same commit.
4. If not fixed: extend the expiry date, note the extension inline (matching the existing
   `# exp:` / `expiry:` comment style), and update "Last reviewed" above.
