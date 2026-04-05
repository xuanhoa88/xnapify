# Cache Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Cache Engine at `shared/api/engines/cache`.
> This engine provides key-value caching with pluggable adapters, namespace isolation, and automatic dev-mode disabling.

---

## Objective

Provide a configurable key-value cache with multiple backend adapters (memory, file, noop), namespace isolation for multi-module scoping, LRU eviction, TTL-based expiration, and automatic development-mode disabling.

## 1. Architecture

```
shared/api/engines/cache/
├── index.js              # Default singleton + re-exports
├── factory.js            # createFactory(), withNamespace()
├── errors.js             # CacheError, InvalidNamespaceError, etc.
├── adapters/
│   ├── memory.js         # MemoryCache — LRU in-memory (sync)
│   ├── file.js           # FileCache — filesystem-backed (async)
│   └── noop.js           # NoOpCache — dev-mode passthrough
└── cache.test.js         # Jest tests (84 tests)
```

### Dependency Graph

```
index.js
├── factory.js
│   ├── adapters/memory.js
│   ├── adapters/file.js (crypto, fs, os, path)
│   ├── adapters/noop.js
│   └── errors.js
└── errors.js
```

## 2. CacheAdapter Interface

All adapters implement these methods:

| Method | Signature | Returns | Sync/Async | Required |
|---|---|---|---|---|
| `get(key)` | `(string)` | value or `null` | Memory: sync, File: async | ✅ |
| `set(key, value, ttl?)` | `(string, any, number?)` | `void` | Memory: sync, File: async | ✅ |
| `delete(key)` | `(string)` | `boolean` | Memory: sync, File: async | ✅ |
| `has(key)` | `(string)` | `boolean` | Memory: sync, File: async | ✅ |
| `clear()` | `()` | `void` | Memory: sync, File: async | ✅ |
| `keys()` | `()` | `string[]` | Memory: sync, File: async | Optional |
| `stats()` | `()` | `object` | Memory: sync, File: async | Optional |
| `cleanup()` | `()` | `number` | Memory: sync, File: async | Optional |
| `size` | getter | `number` | Sync | Optional |

### Standardized Stats Shape

All adapters return a consistent stats shape:

```javascript
{
  type: 'memory' | 'file' | 'noop',
  totalEntries: number,
  validEntries: number,
  expiredEntries: number,
  maxSize: number,
  defaultTTL: number,
  // File adapter only:
  directory: string,
  activeLocks: number,
}
```

## 3. Error Classes (`errors.js`)

| Class | Code | StatusCode | Thrown By |
|---|---|---|---|
| `CacheError` | `CACHE_ERROR` | `500` | Base class |
| `InvalidCacheTypeError` | `INVALID_CACHE_TYPE` | `400` | `createFactory()` — unknown adapter type |
| `InvalidNamespaceError` | `INVALID_NAMESPACE` | `400` | `withNamespace()` — empty, whitespace, or >100 chars |
| `InvalidCacheError` | `INVALID_CACHE` | `400` | `withNamespace()` — missing or invalid base cache |

All errors have: `name`, `code`, `statusCode`, `timestamp`, and stack trace.

## 4. Factory (`factory.js`)

### `createFactory(options?) → CacheAdapter`

Creates a cache adapter instance, attaches `withNamespace()`, and registers signal handlers.

1. Extracts `type` from options (default: `'memory'`).
2. **`__DEV__` guard:** If `__DEV__` is truthy, always creates `NoOpCache` regardless of `type`.
3. In production, creates adapter by `type`:
   - `'memory'` → `MemoryCache`
   - `'file'` → `FileCache`
   - Other → throws `InvalidCacheTypeError`.
4. Attaches `adapter.withNamespace = (ns) => withNamespace(ns, adapter)`.
5. Registers `process.once('SIGTERM')` and `process.once('SIGINT')` handlers that call `adapter.cleanup()`.

### `withNamespace(namespace, baseCache) → NamespacedCache`

Creates a wrapper that prefixes all keys with `namespace:`.

**Validation (throws `InvalidNamespaceError`):**
1. Namespace must be a non-empty string.
2. Namespace cannot be whitespace-only.
3. Namespace must be ≤ 100 characters.

**Validation (throws `InvalidCacheError`):**
4. Base cache must be provided.
5. Base cache must have a `get` method.

**Behavior:**
- `get(key)` → `baseCache.get(prefix + key)`
- `set(key, value, ttl)` → `baseCache.set(prefix + key, value, ttl)`
- `delete(key)` → `baseCache.delete(prefix + key)`
- `has(key)` → `baseCache.has(prefix + key)`
- `clear()` → Uses `baseCache.keys()` to find prefixed keys and deletes them individually. Handles both sync and async `keys()` return. Falls back to `baseCache.clear()` with a console warning if `keys()` is not available.
- `stats()` → delegates to `baseCache.stats()`, returns `null` if unavailable.
- `cleanup()` → delegates to `baseCache.cleanup()`, returns `0` if unavailable.
- `withNamespace(child)` → nested namespacing: `namespace:child:` against the same base adapter.

## 5. Memory Adapter (`adapters/memory.js`)

LRU in-memory cache using `Map` insertion order for eviction. **All operations are synchronous.**

### Configuration

| Option | Default | Description |
|---|---|---|
| `maxSize` | `1000` | Maximum entries before LRU eviction |
| `ttl` | `300000` (5 min) | Default TTL in milliseconds |

### Internal Storage

```javascript
Map<key, { value, expiresAt: number, createdAt: number }>
```

### LRU Behavior

- **`get(key)`**: Deletes and re-inserts the entry to move it to the end (most recently used). Returns `null` for expired entries (lazy deletion).
- **`set(key, value, ttl?)`**: Removes existing entry first (for reordering). While `size >= maxSize`, evicts the oldest entry (`Map.keys().next().value`). Then inserts. Uses single `Date.now()` call for both `expiresAt` and `createdAt`.
- **`has(key)`**: Returns `false` for expired entries (lazy deletion).

### Cleanup

Collects expired keys first, then deletes — avoids mutating `Map` during iteration.

## 6. File Adapter (`adapters/file.js`)

Filesystem-backed cache with persistent storage across restarts. **All operations are async using `fs.promises`.**

### Configuration

| Option | Default | Description |
|---|---|---|
| `directory` | `~/.xnapify/caches` (prod), `.data/caches` (dev) | Cache directory path |
| `maxSize` | `10000` | Maximum cache files |
| `ttl` | `300000` (5 min) | Default TTL in milliseconds |

### File Format

Each entry stored as `<sha256(key).slice(0,32)>.json`:
```javascript
{ key: string, value: any, expiresAt: number, createdAt: number }
```

- **Key hashing**: `crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)`
- **Atomic writes**: Write to `<filename>.tmp.<timestamp>`, then `fs.promises.rename`.

### Concurrency Control

**Async mutex per key** — no busy-wait. Uses a `Map<key, Promise>` to chain operations:

```javascript
async withLock(key, fn) {
  const prev = this.lockQueues.get(key) || Promise.resolve();
  // Chain after previous operation, auto-cleanup when done
}
```

This replaces the previous blocking spin lock. Each key gets its own promise chain, so concurrent operations on different keys run in parallel while operations on the same key are serialized.

### LRU-like Eviction

`evictIfNeeded()` triggers when file count reaches `maxSize`:
1. Reads all cache files, parses their `createdAt`.
2. Sorts by `createdAt` ascending.
3. Removes oldest **10%** (minimum 1 entry).

### Initialization

The constructor stores a `_ready` promise from `ensureDirectory()`. All public methods `await this._ready` before operating, ensuring the directory exists.

### `keys()` Behavior

Reads all `.json` files asynchronously, parses each to extract the original `key` field. Returns only keys from parseable files.

### Cleanup

Removes expired files and corrupted (unparseable) files.

## 7. NoOp Adapter (`adapters/noop.js`)

Development-mode passthrough. Automatically selected when `__DEV__` is truthy.

| Method | Returns |
|---|---|
| `get()` | `null` |
| `set()` | `undefined` |
| `delete()` | `true` |
| `has()` | `false` |
| `clear()` | `undefined` |
| `keys()` | `[]` |
| `stats()` | `{ type: 'noop', totalEntries: 0, validEntries: 0, expiredEntries: 0, maxSize: 0, defaultTTL: 0 }` |
| `cleanup()` | `0` |
| `size` | `0` |

## 8. Default Singleton

**File:** `index.js`

### Named Exports
- `createFactory` — create custom instances
- `withNamespace` — standalone namespace wrapper
- `CacheError`, `InvalidCacheTypeError`, `InvalidNamespaceError`, `InvalidCacheError` — error classes
- `MemoryCache`, `FileCache`, `NoOpCache` — adapter classes

### Default Export
```javascript
const cache = createFactory({
  type: 'memory',
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

The singleton is registered on the DI container as `container.resolve('cache')` during engine autoloading. In `__DEV__` mode, this will be a `NoOpCache` regardless of the options.

## 9. Testing

**File:** `cache.test.js` (84 tests)

### Test Coverage (9 describe blocks)

**Default Instance (Memory):**
- Has all required methods and `withNamespace`.
- `get()`: null for missing, returns stored value, null for expired, handles complex objects.
- `set()`: stores, custom TTL, updates existing, enforces max size.
- `delete()`: returns true/false.
- `has()`: true/false, false for expired.
- `clear()`: removes all, resets size.
- `stats()`: correct shape and counts (valid/expired).
- `cleanup()`: removes expired, returns count.
- `keys()`: returns all, empty for empty cache.
- `size`: tracks entries.

**createFactory():**
- Default memory cache.
- Custom config (maxSize, ttl).
- File cache creation.
- Independent instances.
- Throws `InvalidCacheTypeError` for unsupported type.
- Registers SIGTERM/SIGINT signal handlers.

**withNamespace():**
- Creates from default instance.
- Key prefixing (`users:123`).
- Isolation between namespaces.
- Clear only namespaced keys.
- Works with custom base cache.
- Stats delegation.
- Cleanup delegation.
- Nested namespaces (`api:users:123`).
- Validation: empty, null, whitespace, too-long, missing cache, invalid cache.

**LRU Eviction:**
- Evicts least recently used on `get()` access.
- Updates LRU order on `set()` update.

**FileCache:**
- Directory creation.
- get/set/delete/has/clear/keys/stats/cleanup/getSize.
- Atomic writes (no .tmp files remaining).
- Expired entry handling.
- Complex object serialization.
- Concurrent writes to same key (async mutex).
- Concurrent operations on different keys.
- Eviction at max size.

**NoOpCache:**
- All methods return expected no-op values.
- Stats shape matches standardized format.

**Error Classes:**
- Correct name, code, statusCode, timestamp properties.

**Exports:**
- All adapter classes, factory, withNamespace exported.

## 10. Integration Points

- **Module `boot({ container })`**: Access via `container.resolve('cache')`. Use `withNamespace()` to scope by module.
- **`__DEV__` global**: When truthy, all `createFactory` calls produce `NoOpCache` — ensures fresh data during development.
- **Schedule engine**: Can pair with scheduled `cleanup()` calls for periodic expired-entry removal.
- **Signal handlers**: `SIGTERM`/`SIGINT` automatically call `cleanup()` on the adapter for graceful shutdown.

---

*Note: This spec reflects the CURRENT implementation of the cache engine.*
