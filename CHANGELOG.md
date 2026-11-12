# Changelog

CHANWE's layer on top of Outline (`docker/`, `Dockerfile`, the `.env*.example` files and `docs/es`, `docs/en`).
Outline's own changes are in its releases: https://github.com/outline/outline/releases

## Unreleased

- Umami (Chanwines): the Wiki names its Umami session with the signed-in person's Identity subject (Outline's
  `user_authentications.providerId` for the `oidc` provider), once per page load and never inside the desktop app.
  New `GET /auth/chanwe.subject` (`docker/chanwe-subject.cjs`, patched in by `configure-outline-release.cjs`) and
  `static/chanwe-umami.js`; tests in `docker/chanwe-subject.test.cjs` and `docker/chanwe-umami.test.cjs`.
- Brand copies refreshed from kit 1.1.0 (`pnpm brand:sync`): fg-subtle is now #5B6677, new tokens primary-hover, primary-pressed and shell-bar.
- Docs: `docs/es/` and `docs/en/` with `start_here.md`, `data-tree.md` and `guide.md` for CHANWE's layer.
- `docker/compose.local.yml`: builds the image and runs it locally with a throwaway PostgreSQL and Redis.

## History (from git, before this file existed)

- 2026-11-02: the light theme's sidebar takes the dark theme's look (CHANWE v2).
- 2026-10-27 to 10-30: brand copies from kit 0.85.0 to 0.97.0, app icons v2, orange favicon.
- 2026-10-26: Outline 1.12.0 (image and patch guards).
- 2026-10-18: Outline 1.11.0.
- 2026-10-15/16: `.env.example` and the other environment examples.
- 2026-10-14: 16-byte AES-GCM tags in the legacy PKCE store.
- 2026-10-12: Identity's signing keys fetched from the issuer itself.
- 2026-10-06: 7-day Wiki sessions; Espacios' sign-out revokes the session token (`/auth/chanwe.signout`).
- 2026-10-05: CHANWE brand, «Volver a CHANWE Espacios», `wiki:access` check; Outline 1.10.1 with CHANWE Identity.
