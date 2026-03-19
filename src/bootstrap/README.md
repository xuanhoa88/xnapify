# Bootstrap

Application startup orchestration. Discovers modules, registers engines, applies middleware, and assembles both the API and view routers.

## Overview

The bootstrap layer has two entry points:

- **`api/index.js`** — Server-side API bootstrap: engines → migrations → middleware → module discovery → API router.
- **`views.js`** — Client/server view bootstrap: module discovery → view router with metadata handling.

## API Bootstrap

```javascript
import bootstrap, { APP_PROVIDERS } from '@src/bootstrap/api';

// Returns the assembled Express API router
const apiRouter = await bootstrap(app);
```

### Startup Sequence

1. **Register engines** — All shared engines registered on DI container via `container.instance()`. Engines with `withContext()` receive the container for internal resolution.
2. **Configure passport** — OAuth registry created.
3. **Run migrations** — `db.connection.runMigrations()` + `runSeeds()`.
4. **Global middleware** — Morgan logging + CORS applied.
5. **Discover modules** — Auto-discovers `src/apps/*/api/index.js` → runs lifecycle (models → init → routes) → builds dynamic API router.

### API Middleware Stack

Applied to every API route (before module routes):

1. `refreshToken()` — auto-refreshes expired/near-expiry JWT.
2. `optionalAuth()` — populates `req.user` if token present.

Body parsing scoped to API only:
- `express.json()` — limit: `RSK_JSON_BODY_LIMIT` (default `10mb`)
- `express.urlencoded()` — limit: `RSK_URLENCODED_BODY_LIMIT` (default `1mb`)

## View Router Bootstrap

```javascript
import initializeRouter from '@src/bootstrap/views';

const router = await initializeRouter({ plugin, container });
const page = await router.resolve({ pathname, store });
```

### Features

- **Module discovery** — auto-discovers `src/apps/*/views/index.js` → lifecycle: translations → providers → views.
- **Title handling** — page title suffixed with ` - {AppName}`, or just `{AppName}` if no title.
- **Description fallback** — uses app description from Redux state when page has none.
- **Plugin namespaces** — loaded on route init, unloaded on destroy.
- **Error handling** — `__DEV__`: throws errors. Production: redirects to `/error`.
- **Catch-all** — `/*path` → `/not-found`.

## CORS Configuration

| `RSK_CORS_ORIGIN` Value | Behavior |
|---|---|
| `'true'` | Allow all origins (dev only) |
| `'false'` | Block all origins |
| `'https://example.com,https://*.app.com'` | Whitelist with wildcard support |
| unset | Same-host only (secure default) |

Requests without origin (mobile, curl) are always allowed. Credentials enabled, preflight cached 24h.

## Environment Variables

| Var | Default | Description |
|---|---|---|
| `RSK_CORS_ORIGIN` | same-host | CORS origin whitelist |
| `RSK_JSON_BODY_LIMIT` | `'10mb'` | JSON body size limit |
| `RSK_URLENCODED_BODY_LIMIT` | `'1mb'` | URL-encoded body limit |

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
