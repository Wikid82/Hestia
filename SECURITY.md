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

### [RESOLVED] 2026-08-09 · Debian base image findings (13 CVEs) + npm's bundled tooling (7 CVEs)

The base image was `node:24.19.0-slim` (Debian 12/bookworm) through 2026-08-09. A side-by-side
full-severity scan of alternatives that day showed:

| Base image | Total findings | HIGH/CRITICAL |
|---|---|---|
| `node:24.19.0-slim` (Debian) | 152 | 0 (13 unique CVEs suppressed, see below) |
| `gcr.io/distroless/nodejs24-debian12` | 38 | 6 |
| `node:24.19.0-alpine` | 11 | 0 |

Switched to `node:24.19.0-alpine`. That alone dropped the Debian-specific findings this file used
to document individually (util-linux family CVE-2026-53615, ncurses CVE-2025-69720, gzip
CVE-2026-41992, libacl1 CVE-2026-54369, perl-base's 8 CVEs, zlib1g CVE-2023-45853 — none of them
apply on Alpine's package set). Separately, stripping the bundled npm CLI from the runtime stage
(never invoked there — `CMD` is `node server.js`) eliminated the 7 CVEs in npm's own bundled
`tar`/`brace-expansion`/`ip-address`/`undici`, confirmed gone by rebuilding and re-scanning rather
than assumed.

Net result verified by rescanning the built image with both scanners: 152 Trivy findings → 0.
Remaining findings (both tools): 3 → 1 unique CVE, see below.

### [MEDIUM] CVE-2025-60876 · BusyBox wget HTTP request-splitting (Alpine base image)

| Field | Value |
|---|---|
| **Packages** | busybox, busybox-binsh, ssl_client |
| **Severity** | Medium (CVSS 6.5) |
| **Status** | Awaiting upstream · review by 2026-09-20 |

BusyBox `wget` accepts raw CR/LF and other control bytes in the HTTP request-target, allowing
request-line splitting and attacker-controlled header injection. No fix version published as of
2026-08-09.

**Why it's low-risk here**: Hestia never invokes `wget` or any other busybox applet — the
container's only process is `node server.js` (see Dockerfile `CMD`).

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
