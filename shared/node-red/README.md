# Shared Node-RED

Integrates the Node-RED runtime and admin editor into the Express application. Provides Hot Module Replacement (HMR) capabilities, transparent authentication syncing, split flows for version control, and auto-discovered custom nodes and scripts.

## Quick Start

```javascript
import { NodeRedManager } from '@shared/node-red';

const manager = new NodeRedManager({
  userDir: 'OS-native (e.g. ~/.local/share/xnapify/node-red)',
  enableProjects: false,
});

// Assuming you have your Express app and HTTP server initialized
await manager.init(app, server, {
  httpAdminRoot: '/admin/flows',
  httpNodeRoot: '/flows/api',
});

await manager.start();

// Setup proxy to hit /flows/api internally if needed
manager.setupApiProxy(app, '/proxy');
```

## Features

- **HMR Support**: Properly cleans up socket listeners on `upgrade` events, allowing Node-RED to seamlessly reload in development environments.
- **Auto-Discovery of Custom Nodes**: Any files defined under `shared/node-red/nodes/*.js` that export `getNodeJS()` and `getNodeHTML()` are automatically unpacked into the Node-RED `userDir` and loaded on boot.
- **Client Scripts Injection**: Files under `shared/node-red/client-scripts/*.js` exporting `getScript()` are automatically injected into the Node-RED Admin UI.
- **Flow Splitter**: Automatically splits monolithic `flows.json` files into organized directories (`tabs`, `subflows`, `config-nodes`) inside `<userDir>/src/...`. This creates clean git commits for flows. On start, if `flows.json` is missing, it dynamically reconstructs it from the split files.
- **Unified Authentication**: Provides an `XnapifyAuthStrategy` that connects Node-RED's bearer token logic straight into the main application's JWT mechanism and role-based permissions (`nodered:admin`, `nodered:read`).

## Usage Guide

### Custom Nodes

To expose a custom node to the Node-RED palette:

```javascript
// shared/node-red/nodes/my-custom-node.js

export function getNodeJS() {
  return `
    module.exports = function(RED) {
      function MyCustomNode(config) {
        RED.nodes.createNode(this, config);
        this.on('input', msg => {
          msg.payload = "Modified!";
          this.send(msg);
        });
      }
      RED.nodes.registerType("my-custom-node", MyCustomNode);
    }
  `;
}

export function getNodeHTML() {
  return `
    <script type="text/javascript">
      RED.nodes.registerType('my-custom-node', {
        category: 'function',
        color: '#a6bbcf',
        defaults: { name: { value: "" } },
        inputs: 1,
        outputs: 1,
        icon: "file.svg",
        label: function() { return this.name || "my-custom-node"; }
      });
    </script>
    <script type="text/html" data-template-name="my-custom-node">
      <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" placeholder="Name">
      </div>
    </script>
  `;
}
```

On restart, the node will be written to `<userDir>/nodes/xnapify/my-custom-node.js` and loaded into the palette.

### Flow Splitting

The split logic runs whenever you click "Deploy" in the Node-RED Editor.

Instead of generating one massive `flows.json`, you will see:

```
<userDir>/src/
├── config-nodes/
│   └── _global.json
├── subflows/
│   └── my-subflow.json
└── tabs/
    ├── Flow 1.json
    └── Flow 2.json
```

If you delete `flows.json` and start the server, the flow splitter will read these segmented files and dynamically rebuild the monolithic configuration needed by Node-RED internally.

### Extension Node-RED Nodes (Hot-Loading)

Extensions can provide custom Node-RED nodes that are **hot-loaded into the palette without restarting** the runtime. This uses the same mechanism as Node-RED's built-in Palette Manager (`registry.addModule` / `registry.removeModule`).

To add Node-RED nodes to an extension, add a `"nodered"` object to the extension's `package.json` with `nodes` and optional `flows` paths, then create node files that export `getNodeJS()` and `getNodeHTML()`:

```
src/extensions/my-extension/
├── package.json              # "nodered": { "nodes": "node-red/nodes", "flows": "node-red/flows" }
└── node-red/
    ├── nodes/
    │   └── my-node.js        # Exports getNodeJS() + getNodeHTML()
    └── flows/
        └── my-flow.json      # Optional predefined flows (JSON array)
```

```json
{
  "name": "@xnapify-extension/my-extension",
  "version": "1.0.0",
  "nodered": {
    "nodes": "node-red/nodes",
    "flows": "node-red/flows"
  },
  "description": "My extension with Node-RED nodes"
}
```

> **Note:** Extensions that only provide Node-RED nodes do NOT need `"main"` or `"browser"` in `package.json`. The `"nodered"` key is a standalone valid entry point.

```javascript
// src/extensions/my-extension/node-red/nodes/my-node.js

export function getNodeJS() {
  // Must return a CommonJS module STRING (not a function)
  return `module.exports = function(RED) {
    function MyNode(config) {
      RED.nodes.createNode(this, config);
      this.on('input', function(msg, send, done) {
        msg.payload = "Hello from extension!";
        send(msg);
        if (done) done();
      });
    }
    RED.nodes.registerType("my-node", MyNode);
  };`;
}

export function getNodeHTML() {
  return `
    <script type="text/javascript">
      RED.nodes.registerType('my-node', {
        category: 'xnapify',
        color: '#a6bbcf',
        defaults: { name: { value: "" } },
        inputs: 1,
        outputs: 1,
        icon: "file.svg",
        label: function() { return this.name || "my-node"; }
      });
    </script>
    <script type="text/html" data-template-name="my-node">
      <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" placeholder="Name">
      </div>
    </script>
    <script type="text/html" data-help-name="my-node">
      <p>Help text for my custom node.</p>
    </script>
  `;
}
```

When the extension is enabled, the node appears in the Node-RED palette immediately. When disabled, it is removed — all without restarting the runtime. Connected editors receive live WebSocket notifications (`node/added`, `node/removed`) so the palette updates automatically.

> **Important:** `getNodeJS()` must return a **string** (CommonJS module format with `module.exports`), not a JavaScript function. The string is written to disk and loaded by Node-RED's native module loader.

### Dynamic Settings

Node-RED settings (`HOME`, `LOG_LEVEL`, `PROJECTS`) are resolved from the database-backed settings service at initialization, with environment variable fallbacks:

| Setting Key         | Env Variable                | Default                   |
| ------------------- | --------------------------- | ------------------------- |
| `nodered.HOME`      | `XNAPIFY_NODERED_HOME`      | OS-native (prod) / `<cwd>/.xnapify/node-red` (dev) |
| `nodered.LOG_LEVEL` | `XNAPIFY_NODERED_LOG_LEVEL` | `info`                    |
| `nodered.PROJECTS`  | `XNAPIFY_NODERED_PROJECTS`  | `false`                   |

---

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

Provides a state machine orchestrating Node-RED. Since `@node-red/runtime` behaves like a persistent singleton even during Rspack HMR, this class cleanly wraps its teardown and startup sequences.

### Lifecycle Method Sequencing

1. **`.init(app, server, config)`**:
   - Dynamically imports `@node-red/util`, `@node-red/runtime`, and `@node-red/editor-api` to avoid polluting initial rspack builds.
   - Cleans up trailing `upgrade` server socket listeners lingering from previous HMR passes using `kNodeRedInstance` symbol tagging.
   - Awaits async `settings.js` generation (uses `fs.promises` throughout).
   - Hooks into the ExtensionManager via `.on('extension:loaded')` / `.on('extension:unloaded')` for hot-loading. Old listeners are cleaned up on re-init to prevent HMR leaks.
   - Mounts generated Express routes onto `app`.
2. **`.start()`**: Rapidly spins up `runtime.start()` and `editorApi.start()` wrapped in a `Promise.race` timeout guard. After start, calls `_syncBootModules()` to populate `_extModuleMap` with modules written during boot — enabling correct unload on subsequent toggles.
3. **`.shutdown()`**: Tears down modules (reverse initialization order), removes extension manager listeners, clears `_extModuleMap`/`_extOpQueue`, and executes `.cleanupUpgradeListener()` manually dropping the WebSocket hook.

## Configuration & Auto-Discovery (`settings.js`)

Constructs the Node-RED settings object:

- Merges runtime defaults (like overriding `logLevel`, `projects`, `httpNodeRoot`).
- **Global Context**: Pre-injects commonly used libraries (`lodash`, `dayjs`, `zod`, `uuid`) into the default namespace available within Function nodes.
- **Extraction Magic** (all async via `fs.promises`):
  - `writeCustomNodes(userDir)`: Resolves `import.meta.webpackContext('./nodes')`, extracting `getNodeJS()` and `getNodeHTML()`, and writing physical files to `<userDir>/nodes/xnapify/`. Also scans active extensions' `manifest.nodered.nodes` paths and writes them as `xnapify-nodered-<id>` modules to `<userDir>/node_modules/`.
  - `writeClientScripts(userDir)`: Similar logic for `./client-scripts/`, dropping files in `<userDir>/scripts/` and linking them directly to Node-RED's `editorTheme.page.scripts` UI injection.

## Authentication Synchronization (`auth.js`)

Configures a custom Passport strategy (`XnapifyAuthStrategy`) to replace Node-RED's default internal auth.

1. **Extraction**: Inspects the main Express request via `req.cookies` extracting the main xnapify JWT.
2. **Decryption**: Interrogates the `@shared/jwt` infrastructure via `jwt.verifyTypedToken(token, 'access')` (or `jwt.cache`).
3. **Role Binding**: Triggers the `hook` system (`container.resolve('hook')('auth.permissions')`) fetching the user's explicit permissions. Maps `nodered:admin` to scope `*` and `nodered:read` to scope `read`. Falling out on exceptions pushes users to `/admin`.

## Flow Splitting (`flow-splitter.js`)

Instead of storing configurations inside monolithic `flows.json`, this module plugs into `RED.events.on('flows:started')`:

- **Execution (Split Mode)**: Triggered post-deployment. The script analyzes the raw JSON array configuration grouping nodes into `tabs`, `subflows`, and `config-nodes`. It stores separated JSON arrays natively into `<userDir>/src/`. It auto-deletes the monolithic `flows.json`.
- **Execution (Rebuild Mode)**: Triggered on boot if `flows.json` does NOT exist or the runtime passes an empty flow array. It reads the files in `<userDir>/src/`, merges them, constructs a temporary `flows.json`, and orders `RED.nodes.loadFlows()` to parse them immediately.

## Extension Hot-Loading

Extensions can provide custom Node-RED nodes via the `"nodered"` manifest key (e.g. `"nodered": { "nodes": "node-red/nodes", "flows": "node-red/flows" }`). These nodes are dynamically injected into the running Node-RED runtime using the same registry APIs as the built-in Palette Manager — **zero restart, zero downtime**.

### Boot-Time Discovery

During settings creation (`writeCustomNodes`), all active extensions with a `manifest.nodered` object are scanned. Each extension's node files (from `manifest.nodered.nodes`) are:

1. Loaded via `moduleRequire` to extract `getNodeJS()` and `getNodeHTML()`
2. Written to `<userDir>/node_modules/xnapify-nodered-<id>/` as plain `.js` and `.html` files
3. Bundled with a `package.json` containing a `"node-red": { "nodes": {...} }` stanza

Node-RED's `scanTreeForNodesModules` discovers these modules automatically from `<userDir>/node_modules/`.

### Runtime Hot-Loading

After boot, when an extension is toggled:

- **`extension:loaded`** → `_onExtensionLoaded()` → `writeExtensionNodeModule()` → `registry.addModule(name)` → node live in palette
- **`extension:unloaded`** → `_onExtensionUnloaded()` → `registry.removeModule(name)` → `removeExtensionNodeModule()` → node removed

Connected Node-RED editors receive WebSocket notifications (`runtime-event: node/added` or `node/removed`) so palettes update automatically without manual browser refresh.

### Concurrency Safety

Operations for the same extension are serialized via `_enqueueExtOp()` to prevent race conditions when an admin rapidly toggles an extension. Different extensions can be loaded/unloaded in parallel.

### Extension Developer Contract

Extensions providing Node-RED nodes must:

1. Add `"nodered": { "nodes": "node-red/nodes", "flows": "node-red/flows" }` to `package.json` (paths are relative to the extension root)
2. Create `node-red/nodes/*.js` files that export `getNodeJS()` and `getNodeHTML()`
3. `getNodeJS()` must return a **CommonJS module string** containing `module.exports = function(RED) { ... }`
4. `getNodeHTML()` must return HTML with `<script data-template-name="...">` and `<script data-help-name="...">` sections
5. Register node types via `RED.nodes.registerType("type-name", Constructor)` in the JS string
6. Extensions that only provide Node-RED nodes do NOT need `"main"` or `"browser"` in `package.json`

### Dynamic Settings Integration

Node-RED settings are resolved from the database-backed settings service (`nodered` namespace) at initialization, with environment variable fallbacks:

| DB Key      | Env Variable                | Maps To          |
| ----------- | --------------------------- | ---------------- |
| `HOME`      | `XNAPIFY_NODERED_HOME`      | `userDir`        |
| `LOG_LEVEL` | `XNAPIFY_NODERED_LOG_LEVEL` | `logLevel`       |
| `PROJECTS`  | `XNAPIFY_NODERED_PROJECTS`  | `enableProjects` |
