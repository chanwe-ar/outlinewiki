# Changelog

CHANWE's layer on top of Outline (`docker/`, `Dockerfile`, the `.env*.example` files and `docs/es`, `docs/en`).
Outline's own changes are in its releases: https://github.com/outline/outline/releases

## Unreleased

- The brand guard (`docker/chanwe-brand.test.cjs`) checks all of `docker/` and the tokens' header, and is in every list of tests to run before merging (`start_here.md` left it out; the guide's list gains the export test too).

## 2026-11-23 · the look from chanwe-brandbook (D-0060), theme values from tokens.json, signal tokens

- Brand copies from chanwe-brandbook (D-0062, 2026-11-23): the tokens gain `signal-{ok,warn,fail,plan}` and their `-bg` washes (light and dark), for screens that show a live system's state; nothing else changes.

- The look is written in chanwe-brandbook (D-0060): `docker/chanwe/static/chanwe-outline.css` is a copy of its
  `brand/ui/apps/wiki.css`, and Outline's theme patch (`docker/brand-outline.cjs`) reads every CHANWE value from
  `docker/chanwe/tokens.json`, the brandbook's tokens, copied by its `brand:sync` (the Dockerfile copies it in). The
  patched theme is the same, value for value (21 of 21); the stylesheet gains only a first line naming its source.
  `docker/chanwe-brand.test.cjs` fails on another stylesheet, a copy without that line, or a literal colour in the theme.

- Docs: merging no longer deploys; deploys are by hand (S24, chanwe-proxmox-server, 2026-11-23).

- Brand copies from chanwe-brandbook 2.3.0 (`pnpm brand:sync`): `docker/chanwe/static/tokens.css` gains the new tokens (the dot field `dots.*`, `favorite`, the content elements' `callout`, `eyebrow`, `code`, `syntax`); nothing the Wiki draws changes.

- Brand copies synced from chanwe-brandbook 2.2.0 (`pnpm brand:sync`), the CHANWE v2 drawings this repo had not received
  yet: the Wiki app icon and favicons (`docker/chanwe/images/`, `static/wiki.svg`, `static/favicon-32.png`), the
  wordmark (`static/chanwe-logo.svg`), and `static/tokens.css` (only its comment: the kit's new tokens path).

- robots.txt carries CHANWE's policy (`docker/chanwe-robots.cjs`, run by the Dockerfile): `Content-Signal: search=yes,
  ai-input=yes, ai-train=no` and a `Disallow: /` group for 28 AI-training and SEO-scraper crawlers; Outline's own rules
  stay. The first attempt edited `server/` and `app/`, which the image never builds, and was reverted; the terms link
  on sign-in comes from CHANWE Identity's footer.

## 2026-11-15 · Export menu (Publish Render), Umami identify, kit 1.1 brand copies

- Export: `static/chanwe-export.js` adds «PDF (memo CHANWE)» to a page's download menu and «Markdown (un archivo)» /
  «PDF (memo CHANWE)» to a collection's menu; they link to `/chanwe/export/…`, served by Publish's renderer
  (`chanwe-publish/render`) through Caddy. Tests in `docker/chanwe-export.test.cjs` and, against Outline 1.12's real menu DOM (labels with the `.md`/`.html`
  hint, menus opened from the sidebar left alone), `docker/chanwe-export.dom.test.cjs`.
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
