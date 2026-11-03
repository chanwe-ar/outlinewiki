# Árbol de datos: la Wiki de CHANWE

[English](../en/data-tree.md) · Revisado contra el código el **2026-11-03** (`docker/` y `Dockerfile` de este repo,
`chanwe-proxmox-server/stacks/outline`, `src/domain/authorization/scopes.ts` de Identity). No revisé cantidades de filas
en vivo ni el `.env` real del servidor.

El esquema es de Outline (`server/models`; las migraciones corren solas al arrancar). CHANWE **no agrega tablas ni
columnas**: su capa decide quién puede tener cuenta (los tokens de Identity), cuánto dura una sesión y cómo se ven las
páginas.

## 1. Dónde viven los datos

```mermaid
flowchart LR
  subgraph VM["servidor de casa, VM apps"]
    OUT["contenedor outline<br/>(outlinewiki/outline:1.12.0 + parches CHANWE)"]
    PG[("PostgreSQL 18, contenedor postgres<br/>base outline, rol outline")]
    RD[("Redis (stack cache), base 1<br/>colas, colaboración, rate limits")]
    FS[["/srv/data/outline<br/>archivos y adjuntos (FILE_STORAGE=local)"]]
  end
  OUT --> PG
  OUT --> RD
  OUT --> FS
  B["Navegador / pestaña del escritorio"] -->|wiki.chanwe.ar por Cloudflare Tunnel + Caddy| OUT
```

## 2. Entidades que toca la capa de CHANWE

Son modelos de Outline; el diagrama muestra solo las claves que importan para entrar con Identity.

```mermaid
erDiagram
  TEAM ||--o{ USER : tiene
  TEAM ||--o{ AUTHENTICATION_PROVIDER : "uno por método de acceso"
  AUTHENTICATION_PROVIDER ||--o{ USER_AUTHENTICATION : vincula
  USER ||--o{ USER_AUTHENTICATION : "entra con"
  USER ||--o{ DOCUMENT : escribe
  COLLECTION ||--o{ DOCUMENT : contiene
  TEAM ||--o{ COLLECTION : tiene
  AUTHENTICATION_PROVIDER {
    string name "oidc"
    string providerId "host de OIDC_AUTH_URI (identity.chanwe.ar)"
  }
  USER_AUTHENTICATION {
    string providerId "sub de Identity"
    string scopes
  }
  USER {
    uuid id
    string email "del ID token verificado"
    string name
    string jwtSecret "lo rota /auth/chanwe.signout"
  }
```

## 3. De dónde sale una cuenta de la Wiki

```mermaid
sequenceDiagram
  participant P as Persona
  participant W as Wiki (Outline + parche)
  participant I as CHANWE Identity
  P->>W: abre wiki.chanwe.ar
  W->>I: /authorize (cliente OIDC_CLIENT_ID, PKCE S256, scopes OIDC_SCOPES, por defecto openid profile email, sin resource)
  Note over I: Identity elige el recurso https://api.wiki.chanwe.ar para el cliente de la Wiki
  I-->>P: inicio de sesión (Cognito detrás), revisa el permiso de plataforma
  I->>W: code -> /token: ID token + access token JWT (aud chanwe-wiki-api, scope wiki:access, 15 min)
  W->>I: /.well-known/openid-configuration y {issuer}/jwks (cache de 5 min)
  Note over W: oidc-identity-profile.cjs: RS256, issuer, audience, email_verified,<br/>at_hash, mismo sub, scope wiki:access. Si algo falla, no hay cuenta.
  W->>W: Outline crea o actualiza USER + USER_AUTHENTICATION
  W-->>P: cookie accessToken (7 días), sesión
```

**No** se llama a userinfo: el access token es para el recurso de la Wiki, así que el perfil sale del ID token
verificado (`sub`, `email`, claims de nombre).

## 4. Quién escribe y quién lee

```mermaid
flowchart TB
  TEAMP["Equipo (navegador, pestaña del escritorio)"] -->|escribe y lee documentos| W[(Wiki: base outline + archivos)]
  ID["CHANWE Identity"] -->|tokens en cada inicio de sesión| W
  ESP["Página de salida de Espacios"] -->|GET /auth/chanwe.signout: rota jwtSecret, borra cookies| W
  W -->|notifications.list con la sesión de la Wiki| DESK["App de escritorio (vista previa del dock, avisos)"]
  W -->|API de Outline, clave CHANWE_OUTLINE_API_KEY| CH["Chango (caído por ahora)"]
  BB["chanwe-brandbook brand/consumers.json"] -->|copias de pnpm brand:sync| REPO["docker/chanwe/*"]
  REPO -->|docker build| IMG["imagen chanwe/outline:local"]
```

| Dato | Origen | Quién lo escribe | Quién lo lee |
|---|---|---|---|
| Documentos, colecciones, comentarios | La gente en la Wiki | Outline | Equipo, escritorio (notificaciones), Chango |
| Usuarios y su vínculo con Identity | ID token de Identity al entrar | Outline (después del control de CHANWE) | Outline |
| Sesión (cookies `accessToken` y `sessions`) | Inicio de sesión | Outline, vence a los 7 días (parche) | Outline; las borra `/auth/chanwe.signout` |
| Archivos subidos | La gente | Outline, en `/srv/data/outline` | Outline |
| Archivos de marca | `chanwe-brandbook` | `pnpm brand:sync` en el brandbook | El build de la imagen |
| Secretos (`SECRET_KEY`, `UTILS_SECRET`, `OIDC_CLIENT_SECRET`, clave de la base) | `.env` del stack, chanwe-locker | Ale | El contenedor |
