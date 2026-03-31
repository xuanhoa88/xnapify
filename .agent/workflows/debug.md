---
description: Debug build failures, runtime issues, and development environment problems
---

Debug common build and runtime issues in development mode.

## Quick Fixes

```bash
# Clean rebuild (fixes most issues)
npm run clean && rm -rf node_modules package-lock.json && npm run setup

# Clear webpack cache only
rm -rf node_modules/.cache

# Kill port 1337 if in use
npx kill-port -p 1337
```

---

# Part 1: Build Issues

## Module not found

```bash
rm -rf node_modules package-lock.json
npm run setup
```

## Heap out of memory

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

## CSS/Babel errors

```bash
npm install --save-dev babel-loader css-loader
```

## CSS not loading

```javascript
// Ensure CSS Modules import
import s from './Component.css';
function Component() {
  return <div className={s.container}>...</div>;
}
```

---

# Part 2: Webpack Output

`BUILD_DIR` env var controls where Webpack writes compiled bundles (defined in `tools/config.js`):

| Environment | `BUILD_DIR`  | Source                       |
| ----------- | ------------ | ---------------------------- |
| Development | `.cache/dev` | `.env.development`           |
| Production  | `build`      | default in `tools/config.js` |

### Directory structure (dev mode)

```
.cache/dev/                        ← BUILD_DIR
├── server.js                      ← Server bundle (SSR entry)
├── vendors.js                     ← Server vendor chunk
├── stats.json                     ← Client asset manifest (scripts + stylesheets)
├── updates/                       ← Server HMR hot-update files
│   ├── [fullhash].hot-update.json
│   └── [id].[fullhash].hot-update.js
├── public/                        ← Client bundle output
│   └── assets/
│       ├── client.js              ← Client entry bundle
│       ├── client.css             ← Extracted CSS
│       └── *.chunk.js             ← Code-split chunks
└── extensions/                    ← Compiled extension bundles
    └── <extension-name>/
        ├── main.js                ← Extension server entry
        └── assets/                ← Extension static assets
```

### Key paths

| Artifact           | Path                                       | Config source              |
| ------------------ | ------------------------------------------ | -------------------------- |
| Server bundle      | `BUILD_DIR/server.js`                      | `serverConfig.output`      |
| Client assets      | `BUILD_DIR/public/assets/`                 | `clientConfig.output`      |
| Stats manifest     | `BUILD_DIR/stats.json`                     | `StatsWriterPlugin`        |
| Extension builds   | `BUILD_DIR/<XNAPIFY_EXTENSION_LOCAL_PATH>` | `tools/tasks/extension.js` |
| Server HMR updates | `BUILD_DIR/updates/`                       | `configureWebpackForDev()` |

### Inspect build output

```bash
# List compiled bundles
// turbo
ls -la .cache/dev/

# Check compiled client assets
// turbo
ls -la .cache/dev/public/assets/

# View stats.json (asset manifest used by SSR)
// turbo
cat .cache/dev/stats.json | python3 -m json.tool

# Check compiled extensions
// turbo
ls -la .cache/dev/extensions/
```

---

# Part 3: VS Code Debugger

The project ships with pre-configured launch configurations.

### Start Dev Server with Debugger

1. Stop any running `npm run dev` process first
2. Open VS Code Command Palette (`Cmd+Shift+P`)
3. Select **Debug: Select and Start Debugging**
4. Choose **xnapify: Start Dev Server**
5. Set breakpoints in server-side code (`src/server.js`, controllers, routes, etc.)
6. The debugger auto-attaches to the child process that runs the Webpack dev task

> **Note:** `autoAttachChildProcesses: true` is already set in `.vscode/launch.json`, so breakpoints work in the spawned `node tools/tasks/dev.js` process.

### Debug a Specific Test

1. Command Palette → **Debug: Select and Start Debugging** → **xnapify: Run Tests**
2. Runs Jest with `--runInBand --no-cache` for reliable breakpoint hits

---

# Part 4: Node.js Inspector (Terminal)

```bash
# Start dev server with Node.js inspector
// turbo
node --inspect tools/run dev

# Or break on first line (useful for startup issues)
node --inspect-brk tools/run dev

# Attach to a specific port (if 9229 is busy)
node --inspect=0.0.0.0:9230 tools/run dev
```

Then open `chrome://inspect` in Chrome and click **inspect** on the remote target.

> **Tip:** Since `tools/run.js` spawns the dev task as a child process via `spawn()`, the inspector port for the child may differ. Use `--inspect` in `NODE_OPTIONS` to also inspect the child:
>
> ```bash
> NODE_OPTIONS='--inspect' npm run dev
> ```

---

# Part 5: Verbose Logging

```bash
# Verbose build logging (Webpack stats, HMR details)
// turbo
npm run dev -- --verbose

# Debug-level application logging
// turbo
LOG_LEVEL=debug npm run dev

# Both combined
LOG_LEVEL=debug npm run dev -- --verbose
```

### Environment Variables for Debugging

| Variable      | Purpose                              | Example    |
| ------------- | ------------------------------------ | ---------- |
| `LOG_LEVEL`   | App log verbosity                    | `debug`    |
| `--verbose`   | Build system detail                  | (CLI flag) |
| `DEBUG`       | Debug namespace filter               | `app:*`    |
| `FORCE_COLOR` | Force colored output in piped output | `1`        |

---

# Part 6: Client-Side Debugging

### React DevTools

1. Install [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools) browser extension
2. Open browser DevTools → **Components** / **Profiler** tabs

### Redux DevTools

1. Install [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools) browser extension
2. Open browser DevTools → **Redux** tab
3. Time-travel through dispatched actions and state snapshots

### HMR Status

- Check browser console for `[HMR] connected` — confirms Hot Module Replacement is active
- If HMR disconnects, check terminal for Webpack compilation errors
- HMR endpoint: `/~/__webpack_hmr`

---

# Part 7: Server-Side Debugging Snippets

### Debug middleware

```javascript
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`);
  console.log('  Cookies:', req.cookies);
  console.log('  User:', req.user);
  next();
});
```

### Inspect DI container

```javascript
const auth = req.app.get('container').resolve('auth');
const db = req.app.get('container').resolve('db');
console.log('Auth service:', auth);
console.log('DB connection:', db.connection?.config);
```

### RBAC / Permissions

```javascript
const auth = req.app.get('container').resolve('auth');
const hasPermission = await auth.helpers.hasPermission(userId, 'posts:update');
const roles = await auth.helpers.getUserRoles(userId);
```

### JWT Token

```javascript
const jwt = req.app.get('container').resolve('auth').jwt;
const decoded = jwt.verify(token);
console.log('Token payload:', decoded);
console.log('Is expired:', Date.now() > decoded.exp * 1000);
```

### Auth cookie (httpOnly)

```javascript
// JWT is httpOnly — can't access via document.cookie
// Use the API endpoint instead:
fetch('/api/auth/me').then(res => res.json()).then(console.log);
```

### WebSocket connections

```javascript
const ws = req.app.get('container').resolve('ws');
const stats = ws.getStats();
ws.connections.forEach((conn, id) => {
  console.log({ id, authenticated: conn.authenticated, user: conn.user });
});
```

### Database migrations

```javascript
const db = req.app.get('container').resolve('db');
await db.connection.authenticate(); // Test connection
await db.connection.runMigrations(); // Run pending
await db.connection.revertMigrations(); // Rollback last
```

### Server HMR status messages

- `🔄 Compiling 'server'...` — server bundle recompiling
- `✅ 'server' compiled` — compilation succeeded
- `🔥 HMR: Detected N updated module(s).` — hot update applied
- `❌ HMR update failed` — look at status info

---

# Part 8: Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Port 1337 already in use | Previous process still running | `npx kill-port -p 1337` |
| `Cannot find module` | Stale require cache or missing dep | `npm run setup` or restart |
| Breakpoints not hit | Source maps misconfigured | Ensure `sourceMaps: true` in launch.json |
| HMR says "connected" but no reload | Server compilation error | Check terminal for Webpack errors |
| Slow recompilation | Large watched file tree | Check `ignored` patterns in dev.js |
| API returns HTML instead of JSON | SSR middleware intercepting `/api` | Ensure API routes mounted before SSR |
| SSR hydration mismatch | Browser-only code in render | Use `useEffect` for browser-only logic |
| Redux state not updating | Reducer not returning new object | Use Redux DevTools to inspect |
| `ENOSPC` (Linux) | File watcher limit | Increase `fs.inotify.max_user_watches` |
| `Cannot find module 'sqlite3'` | DB driver not installed | Run `npm run dev` (preboot installs it) or `node tools/preboot.js` |
| `Cannot find module 'pg'` | PG driver not installed | Set `XNAPIFY_DB_URL=postgres` in `.env`, run `npm run dev` |
| PostgreSQL connection refused | PG daemon not running | `node tools/preboot.js --start` |

---

## Clean Restart

When debugging state becomes unreliable:

```bash
npx kill-port -p 1337
rm -rf node_modules/.cache
npm run clean
npm run dev
```

---

# Part 9: Performance Optimization

## Bundle Analysis

```bash
BUNDLE_ANALYZE=true npm run build
```

## Code Splitting

```javascript
import { lazy, Suspense } from 'react';
const Chart = lazy(() => import('./Chart'));

<Suspense fallback={<div>Loading...</div>}>
  <Chart />
</Suspense>;
```

## React Optimization

```javascript
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive components
const ExpensiveList = memo(({ items }) => {
  const sorted = useMemo(() => items.sort((a, b) => a.value - b.value), [items]);
  return <ul>{sorted.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
});

// Stable callbacks
const handleClick = useCallback(id => { console.log(id); }, []);
```

## Database Optimization

```javascript
// Eager loading (avoid N+1)
const posts = await Post.findAll({
  include: [{ model: User, as: 'author' }],
  attributes: ['id', 'title'], // Select only needed fields
});

// Pagination
const { count, rows } = await Post.findAndCountAll({ limit: 20, offset: 0 });

// Add indexes in model options
indexes: [{ fields: ['userId'] }, { fields: ['slug'], unique: true }];
```

## Redux Optimization

```javascript
import { createSelector } from '@reduxjs/toolkit';

// Memoized selector
export const getFilteredUsers = createSelector(
  [state => state.users.items, state => state.users.filter],
  (users, filter) => users.filter(u => u.name.includes(filter)),
);
```

## Performance Checklist

- [ ] Enable code splitting for heavy components
- [ ] Use `React.memo`, `useMemo`, `useCallback` for expensive renders
- [ ] Add database indexes for queried columns
- [ ] Use eager loading to avoid N+1 queries
- [ ] Offload heavy tasks to worker pools
- [ ] Debounce search inputs and frequent events
- [ ] Lazy load images with `loading="lazy"`
