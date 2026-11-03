# Empezá acá: la Wiki de CHANWE (outlinewiki)

[English](../en/start_here.md)

## Qué es este repo

`chanwe-ar/outlinewiki` es el fork de CHANWE de [outline/outline](https://github.com/outline/outline). Corre la Wiki del
equipo en **https://wiki.chanwe.ar**.

La imagen de producción **no** compila Outline desde el código de este repo. El `Dockerfile` parte de la imagen
publicada `outlinewiki/outline:1.12.0` y la parchea al construirla. La capa de CHANWE es solo esto:

| Ruta | Qué hace |
|---|---|
| `Dockerfile` | Fija la versión de Outline, copia los archivos de CHANWE y corre los dos scripts de parches. |
| `docker/configure-outline-release.cjs` | Parches del servidor: PKCE `S256` en el router OIDC, ID token verificado en vez de llamar a userinfo, `GET /auth/chanwe.signout`, sesiones de 7 días. |
| `docker/oidc-identity-profile.cjs` (+ `.test.cjs`) | Verifica el ID token de Identity y el permiso `wiki:access` del access token. |
| `docker/brand-outline.cjs` | Parches del frontend: colores y fuentes de marca en el chunk del tema, sin «Log out», carpeta de assets con hash, archivos de marca en `index.html`, favicon, manifest. |
| `docker/chanwe/static/`, `docker/chanwe/images/` | Archivos de marca (tokens, CSS, fuentes, íconos, el velo de la app, la fila «Volver a CHANWE Espacios» del sidebar). Son copias de `chanwe-brandbook` (`brand/consumers.json`). |
| `docker/precompress-assets.cjs` | Escribe las versiones `.br` y `.gz` de los assets estáticos. |
| `docker/slow-buffer-shim.cjs` | Precarga (`NODE_OPTIONS`) que repone `buffer.SlowBuffer` para dependencias viejas. |
| `docker/enable-oidc-pkce.cjs`, `docker/oidc-pkce-store.cjs` (+ test) | Adaptador PKCE de la imagen 1.10. El `Dockerfile` actual **no lo usa** (Outline 1.12 ya maneja PKCE). |
| `docker/compose.local.yml` | Para correrla local (abajo). |
| `.env.example` | Las variables que define el deploy de CHANWE, más un catálogo auditado contra el código. |

Todo lo demás (`app/`, `server/`, `shared/`, `plugins/`, `docs/ARCHITECTURE.md`…) es Outline tal cual y se documenta en
upstream. No lo cambies acá: no llega a producción.

## Quién la usa

- El equipo de CHANWE, que entra con CHANWE Identity (`identity.chanwe.ar`). Identity da el scope `wiki:access` solo a
  quien tiene la Wiki en su permiso de plataforma.
- Espacios la enlaza, y su página de «cerrar sesión en todo» llama a `https://wiki.chanwe.ar/auth/chanwe.signout`.
- La app de escritorio la abre como pestaña web y lee sus notificaciones (`notifications.list`) con la sesión de la Wiki.
- Chango la lee por la API de Outline (`CHANWE_OUTLINE_API_KEY`); Chango está caído hasta que vuelva en el servidor de casa.

## Dónde corre

**En el servidor de casa** (`chanwe-proxmox-server`), stack `stacks/outline`: contenedor `outline`, construido en la VM
desde `/srv/src/outline` (un checkout de este repo) con este `Dockerfile`, puerto 3000, health `/_health`, detrás de
Caddy y del Cloudflare Tunnel. Base `outline` en el PostgreSQL compartido, Redis base 1, archivos subidos en
`/srv/data/outline`. El servicio `Outlinewiki` de Railway (`chanwe-main-websites`) es historia (sin deploys desde el
2026-10-10).

En el servidor, Outline es un **stack de infraestructura**: un merge a `main` **no** lo despliega solo (ver
[guide.md](guide.md#desplegar)).

## Correrla local

Necesitás Docker. Desde la raíz del repo:

```bash
docker compose -f docker/compose.local.yml up --build
curl -s http://localhost:3000/_health     # "OK" cuando terminaron las migraciones
open http://localhost:3000
docker compose -f docker/compose.local.yml down -v   # borra los datos locales
```

El build en sí es el control principal: cada parche es una coincidencia exacta que corta el build si Outline cambió
por debajo. La página carga con el tema de CHANWE, pero **para entrar hace falta un cliente de Identity** cuya lista de
redirects incluya `http://localhost:3000/auth/oidc.callback` (pasale `OIDC_CLIENT_ID` y `OIDC_CLIENT_SECRET` por el
entorno). Hoy no hay ninguno registrado para localhost (no lo verifiqué contra la configuración en vivo de Identity).

Tests del adaptador de Identity (el test runner de Node; necesitan `jsonwebtoken`, que está en la imagen):

```bash
docker run --rm -v "$PWD/docker:/opt/outline/chanwe-test:ro" --entrypoint node chanwe/outline:local \
  --test chanwe-test/oidc-identity-profile.test.cjs chanwe-test/oidc-pkce-store.test.cjs
```

Sin Docker sirve cualquier carpeta con `jsonwebtoken` 9 instalado (probado el 2026-11-03, pasan los 30 tests):

```bash
NODE_PATH=/ruta/a/node_modules node --test docker/oidc-identity-profile.test.cjs docker/oidc-pkce-store.test.cjs
```

El desarrollo de upstream (`yarn install`, `yarn dev:watch`) funciona como lo documenta Outline, pero corre el código
fuente de Outline, no la versión publicada y parcheada que corre en producción.

## Mapa de la documentación

| Doc | Qué tiene |
|---|---|
| [start_here.md](start_here.md) | Esta página. |
| [data-tree.md](data-tree.md) | Dónde viven los datos de la Wiki, el flujo del inicio de sesión, quién lee y escribe. |
| [guide.md](guide.md) | Cambios del día a día: marca, parche de Identity, actualizar Outline, variables; verificar y desplegar. |
| [`../../CHANGELOG.md`](../../CHANGELOG.md) | La capa de CHANWE, con `## Unreleased` primero. |
| [`../../.env.example`](../../.env.example) | Todas las variables, con valores de ejemplo. |
| `../ARCHITECTURE.md`, `../SERVICES.md`, `../SECURITY.md`, `../TRANSLATION.md`, `../CODE_OF_CONDUCT.md` | Docs de Outline, donde upstream las tiene. |
| `chanwe-proxmox-server/stacks/outline/README.md` | El stack del servidor. |
