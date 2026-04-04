# Shared Node-RED — Technical Specification

## Overview

The `shared/node-red/` module manages the lifecycle, authentication, settings injection, and code splitting configurations necessary to embed Node-RED tightly into the existing xnapify backend cleanly and resiliently.

## Architecture

```
shared/node-red/
├── index.js          # NodeRedManager: Lifecycle orchestrator
├── auth.js           # XnapifyAuthStrategy: Passport adapter mapped to our JWT service
├── settings.js       # Dynamic configuration generation, node extraction
└── flowSplitter.js  # Node-RED event extension for splitting/rebuilding flows
```

## `NodeRedManager` (`index.js`)

Provides a state machine orchestrating Node-RED. Since `@node-red/runtime` behaves like a persistent singleton even during Webpack HMR, this class cleanly wraps its teardown and startup sequences.

### Lifecycle Method Sequencing

1. **`.init(app, server, config)`**:
   - Dynamically imports `@node-red/util`, `@node-red/runtime`, and `@node-red/editor-api` to avoid polluting initial webpack builds.
   - Cleans up trailing `upgrade` server socket listeners lingering from previous HMR passes using `kNodeRedInstance` symbol tagging.
   - Invokes `settings.js` generation.
   - Mounts generated Express routes onto `app`.
2. **`.start()`**: Rapidly spins up `runtime.start()` and `editorApi.start()` wrapped in a `Promise.race` timeout guard.
3. **`.shutdown()`**: Tears down modules (reverse initialization order) and executes `.cleanupUpgradeListener()` manually dropping the WebSocket hook.

## Configuration & Auto-Discovery (`settings.js`)

Constructs the Node-RED settings object:

- Merges runtime defaults (like overriding `logLevel`, `projects`, `httpNodeRoot`).
- **Global Context**: Pre-injects commonly used libraries (`lodash`, `dayjs`, `zod`, `uuid`) into the default namespace available within Function nodes.
- **Extraction Magic**:
  - `writeCustomNodes(userDir)`: Resolves `require.context('./nodes')`, extracting `getNodeJS()` and `getNodeHTML()`, and writing physical files to `<userDir>/nodes/xnapify/`.
  - `writeClientScripts(userDir)`: Similar logic for `./client-scripts/`, dropping files in `<userDir>/scripts/` and linking them directly to Node-RED's `editorTheme.page.scripts` UI injection.

## Authentication Synchronization (`auth.js`)

Configures a custom Passport strategy (`XnapifyAuthStrategy`) to replace Node-RED's default internal auth.

1. **Extraction**: Inspects the main Express request via `req.cookies` extracting the main xnapify JWT.
2. **Decryption**: Interrogates the `@shared/jwt` infrastructure via `jwt.verifyTypedToken(token, 'access')` (or `jwt.cache`).
3. **Role Binding**: Triggers the `hook` system (`container.resolve('hook')('auth.permissions')`) fetching the user's explicit permissions. Maps `nodered:admin` to scope `*` and `nodered:read` to scope `read`. Falling out on exceptions pushes users to `/admin`.

## Flow Splitting (`flow-splitter.js`)

Instead of storing configurations inside monolithic `flows.json`, this module plugs into `RED.events.on('flows:started')`:

- **Execution (Split Mode)**: Triggered post-deployment. The script analyzes the raw JSON array configuration grouping nodes into `tabs`, `subflows`, and `config-nodes`. It stores separated JSON arrays natively into `~/.xnapify/node-red/src/`. It auto-deletes the monolithic `flows.json`.
- **Execution (Rebuild Mode)**: Triggered on boot if `flows.json` does NOT exist or the runtime passes an empty flow array. It reads the files in `~/.xnapify/node-red/src/`, merges them, constructs a temporary `flows.json`, and orders `RED.nodes.loadFlows()` to parse them immediately.
- **Migration Engine**: `saveMigration` automatically maps the `/src/` state into a `YYYY.MM.DDThh.mm.ss` timestamped backup under the `migrations/` directory to prevent layout loss during git swaps.
