# Data tree: CHANWE's Wiki

[Español](../es/data-tree.md) · Checked against the code on **2026-11-03** (this repo's `docker/`, `Dockerfile`,
`chanwe-proxmox-server/stacks/outline`, Identity's `src/domain/authorization/scopes.ts`). Live row counts and the server's
actual `.env` were not checked.

Outline owns its schema (`server/models`, migrations run automatically at start). CHANWE adds **no tables and no
columns**: its layer decides who may get an account (Identity's tokens), how long a session lasts and how the pages look.

## 1. Where the data lives

```mermaid
flowchart LR
  subgraph VM["home server, VM apps"]
    OUT["container outline<br/>(outlinewiki/outline:1.12.0 + CHANWE patches)"]
    PG[("PostgreSQL 18, container postgres<br/>database outline, role outline")]
    RD[("Redis (stack cache), db 1<br/>queues, collaboration, rate limits")]
    FS[["/srv/data/outline<br/>uploads and attachments (FILE_STORAGE=local)"]]
  end
  OUT --> PG
  OUT --> RD
  OUT --> FS
  B["Browser / desktop tab"] -->|wiki.chanwe.ar via Cloudflare Tunnel + Caddy| OUT
```

## 2. Entities that CHANWE's layer touches

These are Outline's own models; the diagram shows only the keys that matter for the Identity sign-in.

```mermaid
erDiagram
  TEAM ||--o{ USER : has
  TEAM ||--o{ AUTHENTICATION_PROVIDER : "one per sign-in method"
  AUTHENTICATION_PROVIDER ||--o{ USER_AUTHENTICATION : links
  USER ||--o{ USER_AUTHENTICATION : "signs in with"
  USER ||--o{ DOCUMENT : writes
  COLLECTION ||--o{ DOCUMENT : contains
  TEAM ||--o{ COLLECTION : has
  AUTHENTICATION_PROVIDER {
    string name "oidc"
    string providerId "hostname of OIDC_AUTH_URI (identity.chanwe.ar)"
  }
  USER_AUTHENTICATION {
    string providerId "Identity sub (subject)"
    string scopes
  }
  USER {
    uuid id
    string email "from the verified ID token"
    string name
    string jwtSecret "rotated by /auth/chanwe.signout"
  }
```

## 3. Where a Wiki account comes from

```mermaid
sequenceDiagram
  participant P as Person
  participant W as Wiki (Outline + patch)
  participant I as CHANWE Identity
  P->>W: open wiki.chanwe.ar
  W->>I: /authorize (client OIDC_CLIENT_ID, PKCE S256, scopes OIDC_SCOPES, default openid profile email, no resource)
  Note over I: Identity picks the resource https://api.wiki.chanwe.ar for the Wiki's client
  I-->>P: sign-in (Cognito upstream), platform grant checked
  I->>W: code -> /token: ID token + JWT access token (aud chanwe-wiki-api, scope wiki:access, 15 min)
  W->>I: /.well-known/openid-configuration, then {issuer}/jwks (cached 5 min)
  Note over W: oidc-identity-profile.cjs: RS256, issuer, audience, email_verified,<br/>at_hash, same sub, scope wiki:access. Any failure: no account.
  W->>W: Outline creates or updates USER + USER_AUTHENTICATION
  W-->>P: cookie accessToken (7 days), session
```

The userinfo endpoint is **not** called: the access token is meant for the Wiki resource, so the profile comes from
the verified ID token (`sub`, `email`, name claims).

## 4. Who writes and reads

```mermaid
flowchart TB
  TEAMP["Team members (browser, desktop tab)"] -->|write and read documents| W[(Wiki: database outline + uploads)]
  ID["CHANWE Identity"] -->|tokens at each sign-in| W
  ESP["Espacios sign-out page"] -->|GET /auth/chanwe.signout: rotates jwtSecret, clears cookies| W
  W -->|notifications.list with the Wiki session| DESK["Desktop app (dock preview, alerts)"]
  W -->|Outline API, key CHANWE_OUTLINE_API_KEY| CH["Chango (down for now)"]
  BB["chanwe-brandbook brand/consumers.json"] -->|pnpm brand:sync copies| REPO["docker/chanwe/*"]
  REPO -->|docker build| IMG["image chanwe/outline:local"]
```

| Data | Source | Writer | Readers |
|---|---|---|---|
| Documents, collections, comments | People in the Wiki | Outline | Team, desktop (notifications), Chango |
| Users and their Identity link | Identity's ID token at sign-in | Outline (after the CHANWE check) | Outline |
| Session (`accessToken` cookie, `sessions` cookie) | Sign-in | Outline, 7-day expiry (patched) | Outline; cleared by `/auth/chanwe.signout` |
| Uploads | People | Outline, `/srv/data/outline` | Outline |
| Brand files | `chanwe-brandbook` | `pnpm brand:sync` in the brandbook | Image build |
| Secrets (`SECRET_KEY`, `UTILS_SECRET`, `OIDC_CLIENT_SECRET`, DB password) | Server stack `.env`, chanwe-locker | Ale | Container |
