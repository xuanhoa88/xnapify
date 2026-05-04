# Shared Node-RED

Integrates the Node-RED runtime and admin editor into the Express application. Provides Hot Module Replacement (HMR) capabilities, transparent authentication syncing, split flows for version control, and auto-discovered custom nodes and scripts.

## Quick Start

```javascript
import { NodeRedManager } from '@shared/node-red';

const manager = new NodeRedManager({
  userDir: '~/.xnapify/node-red',
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
- **Flow Splitter**: Automatically splits monolithic `flows.json` files into organized directories (`tabs`, `subflows`, `config-nodes`) inside `~/.xnapify/node-red/src/...`. This creates clean git commits for flows. On start, if `flows.json` is missing, it dynamically reconstructs it from the split files.
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

On restart, the node will be written to `~/.xnapify/node-red/nodes/xnapify/my-custom-node.js` and loaded into the palette.

### Flow Splitting

The split logic runs whenever you click "Deploy" in the Node-RED Editor.

Instead of generating one massive `flows.json`, you will see:

```
~/.xnapify/node-red/src/
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

| Setting Key | Env Variable | Default |
|---|---|---|
| `nodered.HOME` | `XNAPIFY_NODERED_HOME` | `<cwd>/.xnapify/node-red` |
| `nodered.LOG_LEVEL` | `XNAPIFY_NODERED_LOG_LEVEL` | `info` |
| `nodered.PROJECTS` | `XNAPIFY_NODERED_PROJECTS` | `false` |

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
