---
id: faq
title: FAQ
description: Frequently asked questions about Hestia.
---

# FAQ

### How is Hestia different from Sweepy?

Sweepy (and similar tools) is subscription SaaS — you pay monthly and your
family's data lives on their servers. Hestia is free, MIT-licensed, and
self-hosted: you run it on your own server, NAS, or Raspberry Pi, and your
data never leaves your infrastructure.

### Does Hestia require an account or cloud service?

No. Hestia is fully self-hosted — there's no external account, license
server, or telemetry requirement. The only outbound network dependency is
optional SMTP for sending invite emails, which you configure yourself if
you want it.

### Can multiple families share one Hestia instance?

Yes. One instance can host several independent households with no
cross-visibility between them — see [Features](./features.md#multi-household)
for details. A self-hoster can invite a friend or relative to run their
own separate household on the same instance without either household
seeing the other's data.

### Do kids need their own email address to use Hestia?

No. A "managed profile" has no login credentials of its own — it's
switched into via a Netflix-style avatar picker on a shared/kiosk screen,
optionally protected by a PIN. A managed profile can get its own
email/password login added later if desired.

### Is my data backed up automatically?

Hestia uses SQLite, so your entire household's data is one file
(`./data/hestia.db` in the default Docker setup). Back up that file with
whatever backup tooling you already use for your server — Hestia doesn't
ship its own backup scheduler.

### What happens if I lose the first admin account?

There's currently no built-in "recover the very first admin" flow beyond
normal password-reset (email/password logins can use forgot-password if
SMTP is configured). If you're testing without SMTP configured and lock
yourself out, you'll need direct database access to recover — see the
[Troubleshooting](./troubleshooting.md) page for related setup issues.

### Is Hestia production-ready?

Hestia is early days — actively developed, with core features landing
incrementally. Check the
[GitHub repository](https://github.com/Wikid82/Hestia) for current status
before relying on it for anything critical.

### How do I report a bug or request a feature?

Open an issue on [GitHub](https://github.com/Wikid82/Hestia/issues).

### Can I contribute?

Hestia is MIT-licensed and open to contributions. See the
[GitHub repository](https://github.com/Wikid82/Hestia) for the current
codebase and conventions.
