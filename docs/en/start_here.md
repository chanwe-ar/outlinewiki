# Start here: CHANWE's Wiki (outlinewiki)

[Español](../es/start_here.md)

## What this repo is

`chanwe-ar/outlinewiki` is CHANWE's fork of [outline/outline](https://github.com/outline/outline). It runs the team
Wiki at **https://wiki.chanwe.ar**.

The production image does **not** build Outline from the source in this repo. `Dockerfile` starts from the released
image `outlinewiki/outline:1.12.0` and patches it at build time. CHANWE's layer is only:

| Path | What it does |
|---|---|
| `Dockerfile` | Pins the Outline release, copies CHANWE's files and runs the two patch scripts. |
| `docker/configure-outline-release.cjs` | Server patches: PKCE `S256` on the OIDC router, verified ID token instead of a userinfo call, `GET /auth/chanwe.signout`, 7-day sessions. |
| `docker/oidc-identity-profile.cjs` (+ `.test.cjs`) | Verifies Identity's ID token and the access token's `wiki:access` grant. |
| `docker/brand-outline.cjs` | Frontend patches: brand colours and fonts in Outline's theme chunk, no «Log out», hashed asset folder, brand files in `index.html`, favicon, web manifest. |
| `docker/chanwe/static/`, `docker/chanwe/images/` | Brand files (tokens, CSS, fonts, icons, the app veil, the «Volver a CHANWE Espacios» sidebar row). Copies from `chanwe-brandbook` (`brand/consumers.json`). |
| `docker/precompress-assets.cjs` | Writes `.br` / `.gz` siblings of the static assets. |
| `docker/slow-buffer-shim.cjs` | Preload (`NODE_OPTIONS`) that restores `buffer.SlowBuffer` for older dependencies. |
| `docker/enable-oidc-pkce.cjs`, `docker/oidc-pkce-store.cjs` (+ test) | Legacy PKCE adapter for the 1.10 image. **Not used** by the current `Dockerfile` (Outline 1.12 handles PKCE itself). |
| `docker/compose.local.yml` | Local run (below). |
| `.env.example` | The variables CHANWE's deployment sets, plus a source-audited catalogue. |

Everything else (`app/`, `server/`, `shared/`, `plugins/`, `docs/ARCHITECTURE.md`…) is upstream Outline and is
documented upstream. Do not change it here: it does not reach production.

## Who uses it

- The CHANWE team, signed in through CHANWE Identity (`identity.chanwe.ar`). Identity issues the `wiki:access` scope only
  to people whose platform grant includes the Wiki.
- Espacios links to it, and its «sign out everywhere» page calls `https://wiki.chanwe.ar/auth/chanwe.signout`.
- The desktop app opens it as a web tab and reads its notifications (`notifications.list`) with the Wiki session.
- Chango reads it through the Outline API (`CHANWE_OUTLINE_API_KEY`); Chango is down until it returns on the home server.

## Where it runs

**The home server** (`chanwe-proxmox-server`), stack `stacks/outline`: container `outline`, built on the VM from
`/srv/src/outline` (a checkout of this repo) with this `Dockerfile`, port 3000, health `/_health`, behind Caddy and the
Cloudflare Tunnel. Database `outline` on the shared PostgreSQL, Redis database 1, uploads in `/srv/data/outline`.
The Railway service `Outlinewiki` in `chanwe-main-websites` is history (no deployments since 2026-10-10).

Outline is an **infrastructure stack** on the server: a merge to `main` does **not** deploy it by itself (see
[guide.md](guide.md#deploy)).

## Run it locally

You need Docker. From the repo root:

```bash
docker compose -f docker/compose.local.yml up --build
curl -s http://localhost:3000/_health     # "OK" once migrations have run
open http://localhost:3000
docker compose -f docker/compose.local.yml down -v   # throw the local data away
```

The build itself is the main check: every patch is an exact match that fails the build if Outline changed underneath.
The page loads with the CHANWE theme, but **signing in needs an Identity client** whose redirect list includes
`http://localhost:3000/auth/oidc.callback` (pass `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` in the environment). None is
registered for localhost today (not verified against Identity's live configuration).

Unit tests of the Identity adapter (Node's test runner; they need `jsonwebtoken`, which the image has):

```bash
docker run --rm -v "$PWD/docker:/opt/outline/chanwe-test:ro" --entrypoint node chanwe/outline:local \
  --test chanwe-test/oidc-identity-profile.test.cjs chanwe-test/oidc-pkce-store.test.cjs
```

Without Docker, any folder with `jsonwebtoken` 9 installed works (checked 2026-11-03, 30 tests pass):

```bash
NODE_PATH=/path/to/node_modules node --test docker/oidc-identity-profile.test.cjs docker/oidc-pkce-store.test.cjs
```

Upstream development (`yarn install`, `yarn dev:watch`) works as Outline documents it, but it runs Outline's source,
not the patched release that production runs.

## Map of the docs

| Doc | What's in it |
|---|---|
| [start_here.md](start_here.md) | This page. |
| [data-tree.md](data-tree.md) | Where the Wiki's data lives, the sign-in data flow, who reads and writes it. |
| [guide.md](guide.md) | Day-to-day changes: brand, Identity patch, Outline upgrade, env vars; verify and deploy. |
| [`../../CHANGELOG.md`](../../CHANGELOG.md) | CHANWE's layer, `## Unreleased` first. |
| [`../../.env.example`](../../.env.example) | Every variable, with placeholders. |
| `../ARCHITECTURE.md`, `../SERVICES.md`, `../SECURITY.md`, `../TRANSLATION.md`, `../CODE_OF_CONDUCT.md` | Upstream Outline docs, kept where upstream has them. |
| `chanwe-proxmox-server/stacks/outline/README.md` | The server stack. |
