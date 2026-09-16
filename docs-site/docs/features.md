---
id: features
title: Features
description: What Hestia does today and what's planned for v1.
---

# Features

Hestia is under active development — this page reflects the current state
honestly, including what's planned but not yet built. See the
[GitHub repository](https://github.com/Wikid82/Hestia) for up-to-date
progress.

## Multi-household

One Hestia instance can host several independent households with no
cross-visibility between them. A self-hoster running their own family's
chart can also invite a friend who doesn't want to self-host — that friend
gets their own fully separate household on the same instance, with no
access to anyone else's data.

## Roles

Two independent things, not a tier ladder:

- **Head of Household (HoH)** — full control of their own household
  (members, chores, invites). Scoped to one household only.
- **System admin** — a separate, instance-wide flag independent of
  household membership. Grants cross-household administration, like
  inviting new HoHs or managing instance-wide notification settings. The
  first-ever signup on a fresh instance gets both roles automatically —
  that's the self-hoster who owns the instance.

## Flexible logins per person

Any profile can have its own email + password and log in directly — not
just one shared household login. A profile without one (a "managed
profile," e.g. a kid without an email address) is switched into locally
via a Netflix-style avatar picker on a shared/kiosk screen, optionally
PIN-gated. Either path works for any profile, and a managed profile can
get its own login set up later.

## Invite-based membership

Joining a household you weren't the first signup on always happens by
invite — a system admin invites a new HoH (who gets their own independent
household), or a HoH invites a member of their own household by email.
Open public self-signup is off by default and can be enabled by the
instance operator.

## Recurring, assignable, or open chores

- Chores can repeat daily, weekly, on weekdays, or on a custom schedule.
- A chore can be assigned to a specific household member, or left open for
  anyone in the household to claim.
- Completing a chore awards points.

## Points and streaks

Points and streaks are the gamification layer for v1 — deliberately kept
simple. Hestia is a chore chart, not a game.

## Realtime sync

One profile completing a chore updates another profile's view live, so a
shared kitchen tablet and a parent's phone stay in sync without a manual
refresh.

## Self-hosted by design

- **No account or cloud requirement** — runs entirely on your own
  server/NAS/Raspberry Pi.
- **SQLite** — the whole app backs up by copying one file.
- **Docker image built for amd64 and arm64** — Raspberry Pi and ARM NAS
  friendly.
- **No background jobs** — chore due-dates are computed on read, not via a
  scheduler, keeping the deployment footprint minimal.
