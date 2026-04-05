---
name: engine-development
description: Build and modify shared API engines with correct DI registration, lifecycle management, and factory patterns.
---

# Engine Developer Skill

This skill equips you to build and modify shared infrastructure engines under `shared/api/engines/`. Engines provide cross-cutting services (database, cache, email, etc.) consumed by all modules and extensions via DI.

## Core Concepts

Engines are singleton services registered on the DI container during application bootstrap. They follow a consistent factory pattern and are auto-discovered from `shared/api/engines/*/index.js`.

### Engine Inventory

| Engine | Service Key | Description |
|--------|-------------|-------------|
| `auth` | `'auth'` | JWT, RBAC helpers, permission resolution |
| `cache` | `'cache'` | Key-value cache with LRU, TTL, namespaces |
| `db` | `'db'`, `'models'` | Sequelize ORM connection + model registry |
| `email` | `'email'` | Multi-provider email delivery |
| `fs` | `'fs'` | File operations with path traversal guards |
| `hook` | `'hook'` | Event hook factory for pub/sub |
| `http` | `'http'` | HTTP response helpers (`sendSuccess`, `sendError`) |
| `queue` | `'queue'` | Channel-based pub/sub job queue |
| `schedule` | `'schedule'` | Cron-based task scheduling |
| `search` | `'search'` | Full-text search (FlexSearch/MeiliSearch) |
| `template` | `'template'` | LiquidJS template rendering |
| `webhook` | `'webhook'` | HMAC-signed webhook dispatch/verification |
| `worker` | `'worker'` | Elastic thread pool for CPU-bound worker functions |

---

## Engine Anatomy

Every engine follows this file structure:

```
shared/api/engines/<engine-name>/
├── index.js              # Default singleton export + re-exports
├── factory.js            # Manager class + createFactory()
├── errors.js             # Custom error class (optional)
├── SPEC.md               # AI specification document
├── README.md             # Human documentation (optional)
├── <engine>.test.js      # Jest unit tests
├── __mocks__/            # Manual Jest mocks (optional)
│   └── external-dep.js
├── services/             # Service layer (optional)
│   └── *.js
├── providers/            # Backend providers (optional, e.g. email)
│   └── *.js
├── workers/              # Worker function files (optional)
│   ├── index.js
│   └── *.worker.js
└── utils/                # Shared utilities (optional)
    └── *.js
```

---

## Factory Pattern

### The Factory Function

```javascript
// factory.js
export class EngineManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Initialize internal state
  }

  // Public API methods
  async doWork(input) { /* ... */ }

  // Stats for monitoring
  getStats() { return { /* ... */ }; }

  // Cleanup resources on shutdown
  async cleanup() { /* ... */ }
}

export function createFactory(config) {
  const engine = new EngineManager(config);

  // Register process signal handlers for graceful shutdown
  process.once('SIGTERM', () => engine.cleanup());
  process.once('SIGINT', () => engine.cleanup());

  return engine;
}
```

### The Singleton Export

```javascript
// index.js
import { createFactory, EngineManager } from './factory';

// Named exports for custom instances and type references
export { createFactory, EngineManager };

// Re-export errors
export { EngineError } from './errors';

// Default singleton — auto-registered on DI container
const engine = createFactory();
export default engine;
```

---

## Error Class Pattern

```javascript
// errors.js
export class EngineError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'EngineError';
    this.code = code || 'ENGINE_ERROR';
    this.statusCode = statusCode || 500;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

### Error Conventions

| Property | Type | Purpose |
|----------|------|---------|
| `name` | `string` | Class name for `instanceof` checks |
| `code` | `string` | Machine-readable code (e.g., `'INVALID_INPUT'`) |
| `statusCode` | `number` | HTTP-compatible status (400, 404, 500) |
| `timestamp` | `string` | ISO 8601 creation time |

---

## DI Registration

Engines are registered during the bootstrap phase. The `shared/api/bootstrap.js` auto-discovers engines and binds them to the DI container:

```javascript
// Auto-registration (handled by framework):
container.register('engineName', () => engineSingleton);

// Manual resolution in modules:
const engine = container.resolve('engineName');
```

### Lazy Provider Pattern

Some engines use lazy initialization to avoid startup costs:

```javascript
constructor(config) {
  this._providers = new Map();
  // Providers created on-demand, not at construction
}

getProvider(name) {
  if (!this._providers.has(name)) {
    this._lazyInitProvider(name);
  }
  return this._providers.get(name) || null;
}
```

---

## SPEC.md Template

Every engine MUST have a `SPEC.md` for AI context. Follow this structure:

```markdown
# <Engine Name> Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the
> <Engine Name> Engine at `shared/api/engines/<name>`.

---

## Objective
[One paragraph describing what the engine does]

## 1. Architecture
[Directory tree + dependency graph]

## 2. Core Class
[Constructor, methods, configuration]

## 3. Configuration / Environment Variables
[Table of env vars with defaults]

## 4. Error Handling
[Error classes, codes, status codes]

## 5. Testing
[Test file location, coverage description, mock setup]

## 6. Integration Points
[How modules/extensions consume this engine]

---
*Note: This spec reflects the CURRENT implementation.*
```

---

## Engine Lifecycle

### Initialization Order

```
1. Factory created (constructor)
2. Singleton exported (module-level)
3. DI container binds singleton
4. Module/extension boot() resolves engine
5. Engine methods called during request handling
6. Process signal → cleanup()
```

### Cleanup Pattern

```javascript
async cleanup() {
  // Close connections
  if (this.pool) {
    await this.pool.destroy();
    this.pool = null;
  }
  // Clear internal state
  this.tasks.clear();
  // Log shutdown
  console.info(`[EngineName] Cleaned up`);
}
```

### Signal Registration

Always register cleanup on `SIGTERM` and `SIGINT` in `createFactory()`:

```javascript
process.once('SIGTERM', () => engine.cleanup());
process.once('SIGINT', () => engine.cleanup());
```

---

## Testing Engines

### Test File Pattern

```javascript
// <engine>.test.js
import { createFactory, EngineManager, EngineError } from './index';

describe('[engine] EngineName', () => {
  let engine;

  beforeEach(() => {
    engine = new EngineManager({ /* test config */ });
  });

  afterEach(async () => {
    await engine.cleanup();
  });

  describe('Core Methods', () => {
    it('should do X', async () => {
      const result = await engine.doWork(input);
      expect(result).toEqual(expected);
    });
  });

  describe('Error Handling', () => {
    it('should throw EngineError for invalid input', () => {
      expect(() => engine.doWork(null)).toThrow(EngineError);
    });
  });

  describe('createFactory()', () => {
    it('should return EngineManager instance', () => {
      const instance = createFactory();
      expect(instance).toBeInstanceOf(EngineManager);
    });

    it('should register signal handlers', () => {
      const spy = jest.spyOn(process, 'once');
      createFactory();
      expect(spy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });
});
```

### Manual Mocks

Place manual mocks in `__mocks__/` for external dependencies:

```javascript
// __mocks__/node-cron.js
const tasks = [];
module.exports = {
  schedule: jest.fn((expr, cb, opts) => {
    const task = { start: jest.fn(), stop: jest.fn(), _callback: cb };
    tasks.push(task);
    return task;
  }),
  validate: jest.fn((expr) => expr.split(' ').length >= 5),
  __getMockTasks: () => tasks,
  __clearMockTasks: () => tasks.length = 0,
};
```

---

## Checklist: Creating a New Engine

- [ ] Directory created at `shared/api/engines/<name>/`
- [ ] `factory.js` with Manager class + `createFactory()`
- [ ] `errors.js` with custom error class (code, statusCode, timestamp)
- [ ] `index.js` with singleton export + named re-exports
- [ ] `SPEC.md` following the template above
- [ ] `<name>.test.js` with coverage for: core methods, error handling, factory, cleanup
- [ ] Environment variables prefixed with `XNAPIFY_`
- [ ] Signal handlers (`SIGTERM`, `SIGINT`) registered in factory
- [ ] `cleanup()` method releases all resources

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| Consuming engines from modules | `module-development` skill |
| Consuming engines from extensions | `extension-development` skill |
| Adding a new engine | `/add-engine` workflow |
| Coding standards | `coding-standards` skill |
| Testing patterns | `test-driven-development` skill |
| Security requirements | `security-compliance` skill |
