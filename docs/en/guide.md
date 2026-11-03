# Guide: using and changing CHANWE's Wiki

[Español](../es/guide.md)

## Using it

- Open **https://wiki.chanwe.ar** (or the Wiki tab in the desktop app) and sign in with CHANWE Identity. Only people whose
  Identity grant includes the Wiki get in; anyone else is refused at sign-in, before an account is created.
- There is no «Log out» in the Wiki: sessions end from Espacios (sign out there signs you out of every CHANWE app), or
  after 7 days.
- «Volver a CHANWE Espacios», the first row of the sidebar, goes back to `espacios.chanwe.ar`.
- Writing and organising documents is plain Outline: https://docs.getoutline.com/s/guide

## The rule for changes

Only CHANWE's layer reaches production: `Dockerfile`, `docker/`, the env examples. A change to Outline's source
(`app/`, `server/`, `shared/`, `plugins/`) is **not** in the image, because the image is the released
`outlinewiki/outline` plus patches. Every patch is an exact string match that throws if it does not match exactly once,
so a broken patch fails the build instead of shipping a half-patched Wiki.

Work on a branch, merge to `main` with a note under `## Unreleased` in `CHANGELOG.md`, then deploy (below).

## Day-to-day changes

### Brand files (tokens, fonts, icons, app veil)

1. Change them in `chanwe-brandbook` (`brand/`), never here. The copies in `docker/chanwe/` are listed in its
   `brand/consumers.json`.
2. In the brandbook, `pnpm brand:sync` writes the copies into this repo; commit them here.
3. `docker build -t chanwe/outline:local .` must pass; check the look with the local run.

### Theme colours inside Outline

Outline styles through styled-components, so colours are rewritten in its compiled theme chunk by `THEME` in
`docker/brand-outline.cjs` (pairs `[upstream value, CHANWE value]`). Add or change a pair, rebuild, check. If the build
says `Unexpected Outline … theme`, the upstream value changed: look it up in the release's theme chunk and update the
left side.

### CSS and the sidebar row

`docker/chanwe/static/chanwe-outline.css` (fonts, headings, the Espacios row) and `chanwe-outline.js` (the row and
lifting the veil). Their file names are hashed into `/static/chanwe-<hash>/` at build, so browsers fetch the new copy.

### Identity check

`docker/oidc-identity-profile.cjs`. Change it together with its test, then run the tests (start_here.md). The audience
and scope can also be set with `OIDC_ACCESS_TOKEN_AUDIENCE` and `OIDC_REQUIRED_SCOPE`; their defaults
(`chanwe-wiki-api`, `wiki:access`) match Identity's `WIKI_ACCESS_TOKEN_AUDIENCE` and `WIKI_SCOPES`.

### Upgrade Outline

1. In `Dockerfile`, bump `FROM outlinewiki/outline:<version>`.
2. Bump the version gate (`version !== "…"`) in `docker/configure-outline-release.cjs` and `docker/brand-outline.cjs`.
3. `docker build -t chanwe/outline:local .`. When a patch fails, read the new release's compiled file (inside the image,
   `build/plugins/oidc/server/auth/oidcRouter.js`, `build/server/routes/auth/index.js`, `build/server/utils/authentication.js`,
   `build/app/assets/*.js`) and adapt the match. Never loosen a match to "anywhere".
4. Run the tests and the local run; read Outline's release notes for migrations (they run at start and are not undone
   by a rollback).

On the server, `ssh apps chanwe-update --infra outline --dry-run` tells you whether a newer Outline exists; it never bumps the pin, which lives in this repo.

### Environment variables

Real values live in the server's `stacks/outline/.env` and in chanwe-locker. Add a new one to `.env.example`
(name, one-line comment, placeholder) in the same change. Never commit a value.

## Verify

Before merging:

```bash
docker build -t chanwe/outline:local .                     # every patch matched
docker run --rm -v "$PWD/docker:/opt/outline/chanwe-test:ro" --entrypoint node chanwe/outline:local \
  --test chanwe-test/oidc-identity-profile.test.cjs chanwe-test/oidc-pkce-store.test.cjs
docker compose -f docker/compose.local.yml up --build      # look at http://localhost:3000
```

After deploying: `curl -s https://wiki.chanwe.ar/_health` says `OK`, a sign-in works, the sidebar shows «Volver a CHANWE
Espacios», and a hard reload shows the new look.

## Deploy

Outline is an infrastructure stack on the home server (`INFRA` in `chanwe-proxmox-server/stacks/ops/lib/common.sh`), so
the 5-minute deploy timer does not pick up merges here. After the merge to `main`:

```bash
ssh apps chanwe-update --infra outline --rebuild
```

It resets `/srv/src/outline` to `origin/main`, tags the running image `chanwe/outline:previous`, builds, recreates the
container and waits for it to be healthy. There is no automatic rollback on this path: if the new build is bad, revert
on `main` and run the same command again (the `:previous` image is there for a manual switch). Database migrations
from an Outline upgrade are not undone.
