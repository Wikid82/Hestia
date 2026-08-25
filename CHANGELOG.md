# Changelog

## [0.4.0](https://github.com/Wikid82/Hestia/compare/v0.3.0...v0.4.0) (2026-08-24)


### Features

* backend unit test scaffolding + coverage script + CI wiring ([#73](https://github.com/Wikid82/Hestia/issues/73)) ([2a71836](https://github.com/Wikid82/Hestia/commit/2a71836b42bc14b35d94b6de8147f6379a734421))
* Codecov integration with 85% patch + project gates ([#75](https://github.com/Wikid82/Hestia/issues/75)) ([de88e32](https://github.com/Wikid82/Hestia/commit/de88e320dac9d0f6fd7d767d26d4e983b3817a20))
* forgot/reset password ([#82](https://github.com/Wikid82/Hestia/issues/82)) ([62e04ed](https://github.com/Wikid82/Hestia/commit/62e04ed940796bd58c66fc72ff588c22b64f0e72))
* frontend unit test scaffolding (Vitest) + coverage script + CI wiring ([#74](https://github.com/Wikid82/Hestia/issues/74)) ([cbff7a8](https://github.com/Wikid82/Hestia/commit/cbff7a8c2a9a3e391ac588f099a4b0743c639589))
* invite data model and accept flow (backend) ([#68](https://github.com/Wikid82/Hestia/issues/68)) ([ad4f629](https://github.com/Wikid82/Hestia/commit/ad4f629f09385b7522826e7b5508af564eb87bd8))
* invite UI (send + accept) ([#69](https://github.com/Wikid82/Hestia/issues/69)) ([7131184](https://github.com/Wikid82/Hestia/commit/71311843ba6d6ac219144aa180172aaa937b5857))
* Playwright e2e scaffolding + core-flow coverage ([#78](https://github.com/Wikid82/Hestia/issues/78)) ([64f888c](https://github.com/Wikid82/Hestia/commit/64f888c35c285042cc9758a999ac1160c09641c2))
* self-serve password set/change on existing profiles ([#70](https://github.com/Wikid82/Hestia/issues/70)) ([63918e2](https://github.com/Wikid82/Hestia/commit/63918e212de025cf3b59b2101e4ababca3d08b06))
* SMTP config and mailer service ([#66](https://github.com/Wikid82/Hestia/issues/66)) ([f66f3aa](https://github.com/Wikid82/Hestia/commit/f66f3aac4ab916e3cf790920f2eeec1d9435d2e8))
* split admin into system-admin and household-owner (hoh) roles ([#65](https://github.com/Wikid82/Hestia/issues/65)) ([21e3239](https://github.com/Wikid82/Hestia/commit/21e3239fecd3aa4e13ff4f561f469b245748e485))
* wire go_notify_yourself for admin notifications ([#67](https://github.com/Wikid82/Hestia/issues/67)) ([10e4990](https://github.com/Wikid82/Hestia/commit/10e49904b91197adabdbe296b820bad3eb2c6ca6))


### Bug Fixes

* allow Docker backend build to fetch a newer Go toolchain ([2e986ba](https://github.com/Wikid82/Hestia/commit/2e986ba5eefe91620d61205804b2bf766a725ada))
* decouple auth cookie Secure flag from GIN_MODE via COOKIE_SECURE ([#81](https://github.com/Wikid82/Hestia/issues/81)) ([3ce6f06](https://github.com/Wikid82/Hestia/commit/3ce6f06cf8d6782aa523f9bd8d25d68b9e307ba1))
* pin a distinct Compose project name for the e2e stack ([a402c38](https://github.com/Wikid82/Hestia/commit/a402c38f2a6eb1d7da0ecf8a9afa3b98f3a0f112))
* reject (not silently strip) CRLF in mailer To/Subject ([89d1ed2](https://github.com/Wikid82/Hestia/commit/89d1ed2224729258aefa12e69c030656fe92b1a1))
* sanitize SMTP headers against email content injection ([#84](https://github.com/Wikid82/Hestia/issues/84)) ([419fcb4](https://github.com/Wikid82/Hestia/commit/419fcb4588ac20ac2a8a9694baf6a08ae29ef65e))

## [0.3.0](https://github.com/Wikid82/Hestia/compare/v0.2.4...v0.3.0) (2026-08-17)


### Features

* allow admins to rename the household ([632a636](https://github.com/Wikid82/Hestia/commit/632a6360a82ba47eb418c5210e94703eb0cdc9af))
* household auth, chore-chart data model, and full app UI ([691b644](https://github.com/Wikid82/Hestia/commit/691b6440f4a871125e289f7bc5db199510f7b615))
* Warm Hearth theme system with light/dark/system preference ([#28](https://github.com/Wikid82/Hestia/issues/28)) ([095bf82](https://github.com/Wikid82/Hestia/commit/095bf8294a21814cc426fc324842bde4812d72a8))
* Warm Hearth theme system: light/dark + follow-OS ([#48](https://github.com/Wikid82/Hestia/issues/48)) ([4588189](https://github.com/Wikid82/Hestia/commit/4588189a5b6dbdc280d61ce199b41ecdb3a0a44c))


### Bug Fixes

* accept development-branch CI run as proof of nightly health ([7a3cf5e](https://github.com/Wikid82/Hestia/commit/7a3cf5e7a3ca7473a258f9faed4bebd6aca03500))
* add TZ env var, defaulting to UTC ([d570d12](https://github.com/Wikid82/Hestia/commit/d570d1235bd069a3b70e19a59de1363e1341d9f6))
* bump actions/checkout and actions/setup-node to Node 24 runtime ([fc7054f](https://github.com/Wikid82/Hestia/commit/fc7054f5ae0e8ef7d90a0a87807b87d9d2092b2b))
* keep public/ tracked so the Docker build doesn't fail ([d79c4d0](https://github.com/Wikid82/Hestia/commit/d79c4d0e34e669e7a2d1c5904f7b9aafe9479552))
* point Renovate base branch to development instead of main ([dda7656](https://github.com/Wikid82/Hestia/commit/dda7656780bdf029f432377b35efa72b7aeaf1c6))
* prefix auto-created PR titles with chore: for pr-title-lint ([4b3c8b9](https://github.com/Wikid82/Hestia/commit/4b3c8b91d5d74ed7f3ead0d225c15779950e86b4))
* retry GHCR and Docker Hub logins on transient denial ([88fa2e3](https://github.com/Wikid82/Hestia/commit/88fa2e337e7e1685bd4dd05cd21c41e522810c3b))
* reverse-proxy hardening — subpath support, no hardcoded origins ([#29](https://github.com/Wikid82/Hestia/issues/29)) ([7d787c6](https://github.com/Wikid82/Hestia/commit/7d787c630257ab00fcec89afdad670c0f77d687a))
* reverse-proxy hardening — subpath support, no hardcoded origins ([#51](https://github.com/Wikid82/Hestia/issues/51)) ([393ed05](https://github.com/Wikid82/Hestia/commit/393ed05d665697451082afce2b3cb4e98b9005a4))
* update actions/checkout and renovatebot/github-action versions in Renovate workflow ([7a40575](https://github.com/Wikid82/Hestia/commit/7a40575f83a3f99d9aa4753f79585bebd8bf5261))
* use simple release-type for release-please ([3db4449](https://github.com/Wikid82/Hestia/commit/3db444950621ca074a2aefd9a2ac181b890b1c26))

## [0.2.4](https://github.com/Wikid82/hestia/compare/hestia-v0.2.3...hestia-v0.2.4) (2026-08-10)


### Bug Fixes

* retry GHCR and Docker Hub logins on transient denial ([88fa2e3](https://github.com/Wikid82/hestia/commit/88fa2e337e7e1685bd4dd05cd21c41e522810c3b))

## [0.2.3](https://github.com/Wikid82/hestia/compare/hestia-v0.2.2...hestia-v0.2.3) (2026-08-10)


### Bug Fixes

* accept development-branch CI run as proof of nightly health ([7a3cf5e](https://github.com/Wikid82/hestia/commit/7a3cf5e7a3ca7473a258f9faed4bebd6aca03500))

## [0.2.2](https://github.com/Wikid82/hestia/compare/hestia-v0.2.1...hestia-v0.2.2) (2026-08-09)


### Bug Fixes

* point Renovate base branch to development instead of main ([dda7656](https://github.com/Wikid82/hestia/commit/dda7656780bdf029f432377b35efa72b7aeaf1c6))

## [0.2.1](https://github.com/Wikid82/hestia/compare/hestia-v0.2.0...hestia-v0.2.1) (2026-08-09)


### Bug Fixes

* prefix auto-created PR titles with chore: for pr-title-lint ([4b3c8b9](https://github.com/Wikid82/hestia/commit/4b3c8b91d5d74ed7f3ead0d225c15779950e86b4))

## [0.2.0](https://github.com/Wikid82/hestia/compare/hestia-v0.1.2...hestia-v0.2.0) (2026-08-09)


### Features

* allow admins to rename the household ([632a636](https://github.com/Wikid82/hestia/commit/632a6360a82ba47eb418c5210e94703eb0cdc9af))
* household auth, chore-chart data model, and full app UI ([691b644](https://github.com/Wikid82/hestia/commit/691b6440f4a871125e289f7bc5db199510f7b615))


### Bug Fixes

* add TZ env var, defaulting to UTC ([d570d12](https://github.com/Wikid82/hestia/commit/d570d1235bd069a3b70e19a59de1363e1341d9f6))
* keep public/ tracked so the Docker build doesn't fail ([d79c4d0](https://github.com/Wikid82/hestia/commit/d79c4d0e34e669e7a2d1c5904f7b9aafe9479552))

## [0.1.2](https://github.com/Wikid82/hestia/compare/hestia-v0.1.1...hestia-v0.1.2) (2026-08-08)


### Bug Fixes

* update actions/checkout and renovatebot/github-action versions in Renovate workflow ([7a40575](https://github.com/Wikid82/hestia/commit/7a40575f83a3f99d9aa4753f79585bebd8bf5261))

## [0.1.1](https://github.com/Wikid82/hestia/compare/hestia-v0.1.0...hestia-v0.1.1) (2026-08-08)


### Bug Fixes

* bump actions/checkout and actions/setup-node to Node 24 runtime ([fc7054f](https://github.com/Wikid82/hestia/commit/fc7054f5ae0e8ef7d90a0a87807b87d9d2092b2b))
