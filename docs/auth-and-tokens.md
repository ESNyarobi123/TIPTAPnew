# Authentication and tokens

## Overview

- **Access token**: short-lived JWT (Bearer). Used for `Authorization: Bearer <token>` on `/api/v1/*` (except `@Public()` routes).
- **Refresh token**: opaque random string (base64url). **Never** stored in plain text — only **SHA-256** hash is persisted in `RefreshToken`.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Creates user; **first user in an empty DB** receives `SUPER_ADMIN` only when `NODE_ENV !== 'production'` **or** `ALLOW_BOOTSTRAP_SUPER_ADMIN=true`. **Do not enable bootstrap in production** — use migrations/seed or an explicit break-glass process outside normal register traffic. |
| POST | `/api/v1/auth/login` | Public | Validates bcrypt password; inactive users rejected. |
| POST | `/api/v1/auth/refresh` | Public | Body `{ refreshToken }`. Validates hash, **rotates** refresh (old row revoked, new token issued). |
| POST | `/api/v1/auth/logout` | Public | Body `{ refreshToken }`. Revokes matching row (idempotent if unknown). |
| POST | `/api/v1/auth/logout-all` | JWT | Revokes **all** non-revoked refresh tokens for the current user. |
| GET | `/api/v1/auth/me` | JWT | Profile + role assignments summary. |

## Response shape (register / login / refresh)

```json
{
  "user": { "id": "...", "email": "..." },
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

`expiresIn` is access token lifetime in **seconds** (from `JWT_ACCESS_EXPIRES_IN`, e.g. `15m` → 900).

## Refresh rotation

Each successful refresh **revokes** the presented token and returns a **new** refresh token. Clients must replace the stored refresh token on every refresh.

## Refresh token reuse detection

If a client presents a refresh token whose hash matches a row that is **already revoked** (for example, an old token reused after rotation), the API treats this as possible token theft: it **revokes all non-revoked refresh tokens** for that user, writes an audit entry, and returns **401**. Presenting an **expired but never-revoked** token results in **401** without a family-wide revoke.

## Security notes

- Passwords: **bcrypt** only; `passwordChangedAt` updated on register (and reserved for future password changes).
- Do not log refresh tokens or passwords.
- JWT payload is minimal (`sub`, `email`).
