# Node-RED Migration Guide

Learn how to manage Node-RED flow changes using the Git-friendly migration system.

## Overview

The application uses a custom **Flow Splitter Plugin** (`src/shared/node-red/flow-splitter.js`) to solve the issue of binary-like `flows.json` in version control.

Instead of tracking `flows.json` directly, we track **Migration Snapshots**.

## Workflow

### 1. Development (Making Changes)

1. Start the application: `npm run dev`
2. Open Node-RED Editor: `http://localhost:1337/red/admin`
3. Make changes to your flows.
4. Click **Deploy**.

**What happens automatically:**

1. The plugin detects the deploy event.
2. It splits the new flows into granular JSON files in `.node-red/src/` (tabs, subflows, config-nodes).
3. It compares this state against the latest snapshot in `src/shared/node-red/migrations/`.
4. If changes are detected, it creates a **new snapshot directory**:
   `src/shared/node-red/migrations/YYYY.MM.DDTHH.MM.SS/`

### 2. Committing Changes

You will see untracked files in `src/shared/node-red/migrations/` in your git status.

```bash
git add src/shared/node-red/migrations/
git commit -m "Update payment flow logic"
```

### 3. Production (Deploying)

1. The application starts up.
2. The Node-RED manager initializes.
3. It checks `src/shared/node-red/migrations/` for the latest snapshot.
4. It **rebuilds** the monolithic `flows.json` from that snapshot.
5. Node-RED starts using the rebuilt flows.

---

## Directory Structure

```
src/shared/node-red/
├── migrations/           # ✅ COMMIT THIS
│   ├── 2024.01.01T12.00.00/
│   │   ├── tabs/
│   │   ├── subflows/
│   │   └── config-nodes/
│   └── 2024.01.02T15.30.00/ ...
└── flow-splitter.js      # The plugin logic
```

## Manual Operations

### Force a Migration

If you edited flows but didn't deploy (or if the auto-save failed), you can force a split by restarting the dev server. The plugin runs on both **Deploy** and **Startup**.

### Rollback

To roll back to a previous version of flows:

1. Stop the server.
2. Delete the unwanted migration directories from `src/shared/node-red/migrations/`.
3. Restart the server.
4. The system will rebuild `flows.json` from the remaining latest snapshot.

## Troubleshooting

- **Flows not updating?** Check the console logs for `[rsk-flow-splitter]`. It informs you when it saves a migration or rebuilds flows.
- **Migration not saved?** The plugin compares the current state with the latest migration. if they are identical, it skips saving to avoid noise.
