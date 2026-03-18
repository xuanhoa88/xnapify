# Cache Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Cache Engine at `shared/api/engines/cache`.

---

## Objective

Provide a configurable key-value cache with adapter-based backends, namespace isolation, and automatic dev-mode disabling.

## 1. Architecture

```
shared/api/engines/cache/
├── index.js          # Default singleton (memory, 1000 max, 5min TTL)
├── factory.js        # createFactory(), withNamespace()
├── adapters/
│   ├── memory.js     # MemoryCache — LRU in-memory
│   ├── file.js       # FileCache — filesystem-backed
│   └── noop.js       # NoOpCache — dev-mode passthrough
└── cache.test.js     # Jest tests
```

## 2. Factory (`createFactory`)

- Accepts `{ type, maxSize, ttl, directory }`.
- When `__DEV__` is `true`, always creates `NoOpCache` regardless of `type`.
- Attaches `withNamespace()` instance method to the returned adapter.

## 3. Namespace (`withNamespace`)

- Prefixes all keys with `namespace:`.
- `clear()` only deletes keys with the namespace prefix (uses `keys()` if available, otherwise clears entire cache with warning).
- Supports nested namespacing: `cache.withNamespace('a').withNamespace('b')` → prefix `a:b:`.

## 4. Adapters

All adapters implement: `get`, `set`, `delete`, `has`, `clear`. Optional: `keys`, `stats`, `cleanup`.

- **MemoryCache**: LRU eviction, `maxSize` limit, TTL per entry.
- **FileCache**: Stores entries as JSON files in a directory.
- **NoOpCache**: All reads return `undefined`, all writes are no-ops.

## 5. Default Singleton

`index.js` exports `createFactory({ type: 'memory', maxSize: 1000, ttl: 300000 })`. Registered on DI as `app.get('cache')`.

---

*Note: This spec reflects the CURRENT implementation of the cache engine.*
