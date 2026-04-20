---
id: development-environment
title: Development Environment
sidebar_position: 2
---

# Development Environment

The **xnapify** development environment consists of extensive Node-based automations, intelligent boot scripts, and carefully scoped environment variables to ensure local testing remains closely aligned with production architecture requirements.

---

## 1. Development Lifecycle Scripts

All standard lifecycle interactions route through a centralized script loader `tools/run.js`. Do not run Webpack or Jest explicitly from the command line — utilize the provided Node wrappers.

| Command | Purpose | Explanation |
| --- | --- | --- |
| `npm run setup` | Install & Scaffolding | Installs dependencies safely using `tools/npm/setup.js`. This is critical over standard `npm i` since xnapify requires resolving multi-level dependencies. |
| `npm run dev` | Local Dev Server | Triggers the `preboot.js` daemon analysis, followed by spinning up the Express server and Webpack compilers with Hot-Module-Replacement enabled. |
| `npm run build` | Compile Production | Bakes React into static assets and bundles the Express server removing all Dev tooling dependencies. |
| `npm run clean` | Artifact Wiping | Recursively deletes `.cache`, `build`, and residual Webpack generation files. Useful for resolving obscure state caching errors natively. |

---

## 2. Environment Variables (`.env`)

Configuration is managed via `.env` files. The project commits a verbose template file called `.env.xnapify`. To build out your local workspace, simply copy it to `.env`:

```bash
cp .env.xnapify .env
```

### The Strict Variable Convention

Due to Server-Side Rendering (SSR) paradigms, environment configurations present severe security risks if leaked into the React DOM bundle. xnapify operates a rigid prefixing convention processed at compile-time by `Webpack DefinePlugin`:

- **Client Visible Variables (Danger):** Only variables explicitly prefixed with `XNAPIFY_PUBLIC_` are allowed to be baked into the client bundle and sent to the browser.
- **Server Internal Variables:** Any default `XNAPIFY_` variable remains exclusive to the Node Server runtimes processing API requests or Server Rendering.
- **Extreme Secrets (`_KEY` suffix):** To prevent logging leakage or accidental public injections, variables housing sensitive hashes or keys must conclude with `_KEY`. (e.g. `XNAPIFY_JWT_SIGNING_KEY`).

> [!WARNING]
> React code inside `views/` or `components/` attempting to read `process.env.XNAPIFY_SECRET_KEY` will result in `undefined`. Only `XNAPIFY_PUBLIC_APP_NAME` and similar mappings will evaluate correctly in the client's web browser process.

---

## 3. The Database Preboot Engine

Before executing `npm run dev`, xnapify runs `tools/npm/preboot.js`. This daemon operates as an intelligent platform resolution guard.

### Dynamic Daemon Management

If your `.env` requests a MySQL or Postgres database via `XNAPIFY_DB_URL`, but the server fails to detect a listening port on `localhost`, the preboot engine does **not** crash.

Instead, the `preboot.js` engine will:
1. Attempt to download a portable embedded database binary matching your host architecture natively.
2. Spin up the Database into an OS background daemon explicitly linked to the xnapify working directory.
3. Establish the missing relational databases and necessary credential mappings automatically.

You can manage these embedded databases explicitly utilizing the command line arguments:
```bash
# Start embedded databases defined within .env manually
node tools/npm/preboot.js --start

# Cleanly shutdown the background OS daemons
node tools/npm/preboot.js --stop

# Check status of port allocations and daemon existence
node tools/npm/preboot.js --status
```

---

## 4. Build Configuration Registry

In modern monorepo and plugin-based architectures, standardizing how modules define and alter structural building tools (like PostCSS, Webpack, and ESLint) is critical. 

The `xnapify` build pipeline centralizes this process using a **Barrel Registry Mechanism** (`tools/registry.factory.js`). This negates intensive synchronous filesystem lookups and prevents the global injection of isolated dependencies.

### Module-Level Escape Hatches

A module developer can drop a specific configuration file in the root of their module (e.g. `src/apps/groups/`) and the build pipeline will implicitly apply that configuration **only** to that module boundary.

Supported configurations include:

- **Webpack (`module.webpack.js`):** Intercepts internal compilation states (both Client and Server configurations) and merges or mutates the properties dynamically. Applies comprehensively for both Core Apps and Extensions.
- **PostCSS (`module.postcss.js`):** Triggers CSS loaders via Webpack injection parameters specifically for `.css` files existing under that module's structural boundary via a synchronized fast-lookup iteration.
- **ESLint (`module.eslint.js`):** Pushes the localized standard safely into the global ESLint parser `overrides` array tightly bounded strictly to `{ files: [moduleDir/**/*.{js,jsx}] }`.

### The `.factory.js` Naming Paradigm

Within the structural `tools/` directory, files managing specific runtime environments carry a `.factory.js` suffix (e.g., `eslint.factory.js`, `postcss.factory.js`). Using generic `.config.js` names internally risks aggressive **Search Collisions** (e.g. `CMD+P` yielding the tools file *and* the root file simultaneously).

Instead, "zero-config" development compatibility (like the VS Code ESLint parser finding configs immediately) is satisfied using lightweight **Proxy Exports** natively situated at the project's system root boundary:

```javascript
// .eslintrc.js (Root Level)
module.exports = require('./tools/eslint.factory.js');
```
