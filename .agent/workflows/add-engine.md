---
description: Add a new engine to the shared API infrastructure
---

Add a new engine under `shared/api/engines/`. Engines are auto-discovered and re-exported from `@shared/api`.

## Engine Structure

```
shared/api/engines/{engine-name}/
├── index.js              # Public API (auto-loaded)
├── {engine-name}.test.js # Tests
├── README.md             # Documentation
└── SPEC.md               # Specification (optional)
```

## Step-by-Step

### 1. Create Engine Directory

```bash
mkdir -p shared/api/engines/{engine-name}
```

### 2. Create Engine Entry (`index.js`)

The auto-loader in `shared/api/index.js` discovers engines from `engines/*/index.js`. The default export becomes the base interface; named exports are merged in.

```javascript
// shared/api/engines/{engine-name}/index.js

/**
 * {EngineName} Engine
 *
 * @example
 * import { {engineName} } from '@shared/api';
 * {engineName}.doSomething();
 */

class {EngineName}Engine {
  constructor() {
    // Initialize engine state
  }

  doSomething(options) {
    // Engine logic
  }
}

// Singleton instance
const engine = new {EngineName}Engine();

export default engine;
```

**Alternative — Function-based engine:**

```javascript
export function create(options) {
  // Factory function
}

export function destroy(instance) {
  // Cleanup
}
```

### 3. Verify Auto-Loading

Once `index.js` exists, the engine is automatically available:

```javascript
import { {engineName} } from '@shared/api';
```

No manual registration needed — the webpack `require.context` in `shared/api/index.js` handles it.

### 4. Write Tests

// turbo
```bash
npm run test -- {engine-name}
```

Create `{engine-name}.test.js` alongside the engine:

```javascript
import { {engineName} } from '@shared/api';

describe('{EngineName} Engine', () => {
  it('should initialize correctly', () => {
    expect({engineName}).toBeDefined();
  });

  it('should perform core functionality', () => {
    // Test engine methods
  });
});
```

### 5. Run Full Suite

// turbo
```bash
npm test
```

## Existing Engines Reference

| Engine | Purpose |
|---|---|
| `auth` | Authentication middlewares & cookies |
| `cache` | LRU caching |
| `db` | Sequelize ORM & migrations |
| `email` | Nodemailer service |
| `fs` | Filesystem operations |
| `hook` | Channel-based event system |
| `http` | HTTP client utilities |
| `queue` | Job queue |
| `schedule` | Cron scheduling |
| `search` | Full-text search |
| `template` | LiquidJS template engine |
| `webhook` | Webhook engine |

---

## See Also

- `/add-module` — Modules that consume engines via DI
- `/add-test` — Jest tests colocated with engine source
- `/add-worker` — Worker function patterns
- `/debug` — Part 2 covers build output inspection
