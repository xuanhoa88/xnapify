---
description: Debug the application in development mode with breakpoints, logging, and inspection tools
---

Debug the running dev server (client + server) using Node.js inspector, VS Code debugger, browser DevTools, and verbose logging.

## 1. VS Code Debugger (Recommended)

The project ships with pre-configured launch configurations.

### Start Dev Server with Debugger

1. Stop any running `npm run dev` process first
2. Open VS Code Command Palette (`Cmd+Shift+P`)
3. Select **Debug: Select and Start Debugging**
4. Choose **RSK: Start Dev Server**
5. Set breakpoints in server-side code (`src/server.js`, controllers, routes, etc.)
6. The debugger auto-attaches to the child process that runs the Webpack dev task

> **Note:** `autoAttachChildProcesses: true` is already set in `.vscode/launch.json`, so breakpoints work in the spawned `node tools/tasks/dev.js` process.

### Debug a Specific Test

1. Command Palette → **Debug: Select and Start Debugging** → **RSK: Run Tests**
2. Runs Jest with `--runInBand --no-cache` for reliable breakpoint hits

---

## 2. Node.js Inspector (Terminal)

Attach Chrome DevTools or VS Code to a running dev server.

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

## 3. Verbose Logging

Enable detailed output from the build system and application.

```bash
# Verbose build logging (shows Webpack stats, HMR details)
// turbo
npm run dev -- --verbose

# Debug-level application logging
// turbo
LOG_LEVEL=debug npm run dev

# Both combined
LOG_LEVEL=debug npm run dev -- --verbose
```

### Environment Variables for Debugging

| Variable       | Purpose                              | Example            |
| -------------- | ------------------------------------ | ------------------ |
| `LOG_LEVEL`    | App log verbosity                    | `debug`            |
| `--verbose`    | Build system detail                  | (CLI flag)         |
| `DEBUG`        | Debug namespace filter               | `app:*`            |
| `FORCE_COLOR`  | Force colored output in piped output | `1`                |

---

## 4. Webpack Output Directories

Understanding where compiled bundles land helps when inspecting build output, stale caches, or extension loading.

### Build directory layout

Controlled by `BUILD_DIR` env var (defined in `tools/config.js`):

| Environment   | `BUILD_DIR`    | Source                    |
| ------------- | -------------- | ------------------------- |
| Development   | `.cache/dev`   | `.env.development`        |
| Production    | `build`        | default in `tools/config.js` |

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

### Key paths (from `tools/webpack/app.config.js`)

| Artifact              | Path                                | Config source          |
| --------------------- | ----------------------------------- | ---------------------- |
| Server bundle         | `BUILD_DIR/server.js`               | `serverConfig.output`  |
| Client assets         | `BUILD_DIR/public/assets/`          | `clientConfig.output`  |
| Stats manifest        | `BUILD_DIR/stats.json`              | `StatsWriterPlugin`    |
| Extension builds      | `BUILD_DIR/<RSK_EXTENSION_LOCAL_PATH>` | `tools/tasks/extension.js` |
| Server HMR updates    | `BUILD_DIR/updates/`                | `configureWebpackForDev()` in `dev.js` |

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

# Override build directory
BUILD_DIR=./my-debug-build npm run dev
```

---

## 5. Client-Side Debugging

### React DevTools

1. Install [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools) browser extension
2. Open browser DevTools → **Components** / **Profiler** tabs
3. Inspect component tree, props, state, and hooks

### Redux DevTools

1. Install [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools) browser extension
2. Open browser DevTools → **Redux** tab
3. Time-travel through dispatched actions and state snapshots

### HMR Status

- Check browser console for `[HMR] connected` — confirms Hot Module Replacement is active
- If HMR disconnects, check terminal for Webpack compilation errors
- HMR endpoint: `/~/__webpack_hmr`

---

## 6. Server-Side Debugging Snippets

### Add a quick debug middleware

```javascript
// Temporarily add before your route to inspect requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`);
  console.log('  Headers:', JSON.stringify(req.headers, null, 2));
  console.log('  Cookies:', req.cookies);
  console.log('  User:', req.user);
  next();
});
```

### Inspect DI container

```javascript
// Inside a route handler or middleware
const auth = req.container.resolve('auth');
const db = req.container.resolve('db');
console.log('Auth service:', auth);
console.log('DB connection:', db.connection?.config);
```

### Debug server HMR reload

Watch terminal for these messages during HMR:
- `🔄 Compiling 'server'...` — server bundle recompiling
- `✅ 'server' compiled` — compilation succeeded
- `🔥 HMR: Detected N updated module(s).` — hot update applied
- `✅ Server reloaded successfully` — new bundle is live

If HMR fails, look for `❌ HMR update failed` with status info.

---

## 7. Common Dev-Mode Issues

| Symptom                        | Cause                              | Fix                                       |
| ------------------------------ | ---------------------------------- | ----------------------------------------- |
| Port 1337 already in use       | Previous process still running     | `npx kill-port -p 1337`                   |
| Breakpoints not hit            | Source maps misconfigured          | Ensure `sourceMaps: true` in launch.json  |
| HMR says "connected" but no reload | Server compilation error        | Check terminal for Webpack errors         |
| `Cannot find module` on reload | Stale require cache                | Restart dev server                        |
| Slow recompilation             | Large watched file tree            | Check `ignored` patterns in dev.js        |
| API returns HTML instead of JSON | SSR middleware intercepting `/api` | Ensure API routes are mounted before SSR  |

---

## 8. Clean Restart

When debugging state becomes unreliable:

```bash
# Kill stuck processes and clean caches
npx kill-port -p 1337
rm -rf node_modules/.cache
npm run clean

# Fresh start
npm run dev
```
