# Guía: usar y cambiar la Wiki de CHANWE

[English](../en/guide.md)

## Usarla

- Abrí **https://wiki.chanwe.ar** (o la pestaña Wiki de la app de escritorio) y entrá con CHANWE Identity. Entra solo
  quien tiene la Wiki en su permiso de Identity; a cualquier otra persona se la rechaza al entrar, antes de crearle cuenta.
- La Wiki no tiene «Log out»: la sesión se cierra desde Espacios (salir ahí te saca de todas las apps de CHANWE) o a los
  7 días.
- «Volver a CHANWE Espacios», la primera fila del sidebar, te lleva a `espacios.chanwe.ar`.
- Escribir y ordenar documentos es Outline tal cual: https://docs.getoutline.com/s/guide

## La regla para cambiar algo

A producción llega solo la capa de CHANWE: `Dockerfile`, `docker/` y los ejemplos de entorno. Un cambio en el código de
Outline (`app/`, `server/`, `shared/`, `plugins/`) **no** entra en la imagen, porque la imagen es el
`outlinewiki/outline` publicado más los parches. Cada parche es una coincidencia exacta que tira error si no aparece
exactamente una vez, así que un parche roto corta el build en vez de publicar una Wiki a medio parchear.

Trabajá en una rama, mergeá a `main` con una nota bajo `## Unreleased` en `CHANGELOG.md` y después desplegá (abajo).

## Cambios del día a día

### Archivos de marca (tokens, fuentes, íconos, velo)

1. Cambialos en `chanwe-brandbook` (`brand/`), nunca acá. Las copias de `docker/chanwe/` están listadas en su
   `brand/consumers.json`.
2. En el brandbook, `pnpm brand:sync` escribe las copias en este repo; commitealas acá.
3. `docker build -t chanwe/outline:local .` tiene que pasar; mirá cómo queda con la corrida local.

### Colores del tema de Outline

Outline estiliza con styled-components, así que los colores se reescriben en el chunk compilado del tema con `THEME`
de `docker/brand-outline.cjs` (pares `[valor de upstream, valor de CHANWE]`). Agregá o cambiá un par, reconstruí y
revisá. Si el build dice `Unexpected Outline … theme`, cambió el valor de upstream: buscalo en el chunk del tema de la
versión nueva y actualizá el lado izquierdo.

### CSS y la fila del sidebar

`docker/chanwe/static/chanwe-outline.css` (fuentes, títulos, la fila de Espacios) y `chanwe-outline.js` (la fila y
levantar el velo). Se publican bajo `/static/chanwe-<hash>/`, con un hash del contenido, así que el navegador baja la
copia nueva.

### El control de Identity

`docker/oidc-identity-profile.cjs`. Cambialo junto con su test y corré los tests (start_here.md). La audiencia y el scope
también se pueden fijar con `OIDC_ACCESS_TOKEN_AUDIENCE` y `OIDC_REQUIRED_SCOPE`; los valores por defecto
(`chanwe-wiki-api`, `wiki:access`) coinciden con `WIKI_ACCESS_TOKEN_AUDIENCE` y `WIKI_SCOPES` de Identity.

### Actualizar Outline

1. En el `Dockerfile`, subí `FROM outlinewiki/outline:<versión>`.
2. Subí el control de versión (`version !== "…"`) en `docker/configure-outline-release.cjs` y `docker/brand-outline.cjs`.
3. `docker build -t chanwe/outline:local .`. Si falla un parche, leé el archivo compilado de la versión nueva (dentro de
   la imagen: `build/plugins/oidc/server/auth/oidcRouter.js`, `build/server/routes/auth/index.js`,
   `build/server/utils/authentication.js`, `build/app/assets/*.js`) y adaptá la coincidencia. Nunca la aflojes a
   "en cualquier parte".
4. Corré los tests y la versión local; leé las notas de la versión de Outline por migraciones (corren al arrancar y un
   rollback no las deshace).

En el servidor, `ssh apps chanwe-update --infra outline --dry-run` te dice si hay un Outline más nuevo; nunca sube la
versión fijada, que vive en este repo.

### Variables de entorno

Los valores reales están en `stacks/outline/.env` del servidor y en chanwe-locker. Si agregás una, sumala a
`.env.example` (nombre, comentario de una línea, valor de ejemplo) en el mismo cambio. Nunca commitees un valor.

## Verificar

Antes de mergear:

```bash
docker build -t chanwe/outline:local .                     # todos los parches coincidieron
docker run --rm -v "$PWD/docker:/opt/outline/chanwe-test:ro" --entrypoint node chanwe/outline:local \
  --test chanwe-test/oidc-identity-profile.test.cjs chanwe-test/oidc-pkce-store.test.cjs \
  chanwe-test/chanwe-subject.test.cjs chanwe-test/chanwe-umami.test.cjs
docker compose -f docker/compose.local.yml up --build      # mirá http://localhost:3000
```

Después de desplegar: `curl -s https://wiki.chanwe.ar/_health` responde `OK`, se puede entrar, el sidebar muestra
«Volver a CHANWE Espacios» y una recarga forzada muestra lo nuevo.

## Desplegar

En el servidor de casa, Outline es un stack de infraestructura (`INFRA` en
`chanwe-proxmox-server/stacks/ops/lib/common.sh`), así que el timer de deploy de cada 5 minutos no toma los merges de
acá. Después del merge a `main`:

```bash
ssh apps chanwe-update --infra outline --rebuild
```

Lleva `/srv/src/outline` a `origin/main`, etiqueta la imagen que corre como `chanwe/outline:previous`, construye,
recrea el contenedor y espera a que esté sano. Este camino no tiene rollback automático: si el build nuevo sale mal,
revertí en `main` y corré el mismo comando (la imagen `:previous` queda para cambiarla a mano). Las migraciones de una
actualización de Outline no se deshacen.
