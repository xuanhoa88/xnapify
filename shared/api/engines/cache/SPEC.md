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
├── index.js              # Default singleton
├── factory.js            # createFactory(), withNamespace()
├── adapters/
│   ├── memory.js         # MemoryCache — LRU in-memory
│   ├── file.js           # FileCache — filesystem-backed with locks
│   └── noop.js           # NoOpCache — dev-mode passthrough
└── cache.test.js         # Jest tests
```

### Dependency Graph

```
index.js
└── factory.js
    ├── adapters/memory.js
    ├── adapters/file.js (crypto, fs, os, path)
    └── adapters/noop.js
```

No error classes file — errors are thrown inline with custom `name` and `status` properties.

## 2. CacheAdapter Interface

All adapters implement these methods:

| Method | Signature | Returns | Required |
|---|---|---|---|
| `get(key)` | `(string)` | value or `null` | ✅ |
| `set(key, value, ttl?)` | `(string, any, number?)` | `void` | ✅ |
| `delete(key)` | `(string)` | `boolean` | ✅ |
| `has(key)` | `(string)` | `boolean` | ✅ |
| `clear()` | `()` | `void` | ✅ |
| `keys()` | `()` | `string[]` | Optional |
| `stats()` | `()` | `object` | Optional |
| `cleanup()` | `()` | `number\|Promise<void>` | Optional |
| `size` | getter | `number` | Optional |

## 3. Factory (`factory.js`)

### `createFactory(options?) → CacheAdapter`

Creates a cache adapter instance, then attaches `withNamespace()` to it.

1. Extracts `type` from options (default: `'memory'`).
2. **`__DEV__` guard:** If `__DEV__` is truthy, always creates `NoOpCache` regardless of `type`.
3. In production, creates adapter by `type`:
   - `'memory'` → `MemoryCache`
   - `'file'` → `FileCache`
   - Other → throws `InvalidCacheTypeError` (status 400).
4. Attaches `adapter.withNamespace = (ns) => withNamespace(ns, adapter)`.

### `withNamespace(namespace, baseCache) → NamespacedCache`

Creates a wrapper that prefixes all keys with `namespace:`.

**Validation (throws `InvalidNamespaceError`, status 400):**
1. Namespace must be a non-empty string.
2. Namespace cannot be whitespace-only.
3. Namespace must be ≤ 100 characters.

**Validation (throws `InvalidCacheError`, status 400):**
4. Base cache must be provided.
5. Base cache must have a `get` method.

**Behavior:**
- `get(key)` → `baseCache.get(prefix + key)`
- `set(key, value, ttl)` → `baseCache.set(prefix + key, value, ttl)`
- `delete(key)` → `baseCache.delete(prefix + key)`
- `has(key)` → `baseCache.has(prefix + key)`
- `clear()` → Uses `baseCache.keys()` to find prefixed keys and deletes them individually. Handles both sync and async `keys()` return. Falls back to `baseCache.clear()` with a console warning if `keys()` is not available.
- `stats()` → delegates to `baseCache.stats()`, returns `null` if unavailable.
- `cleanup()` → delegates to `baseCache.cleanup()`, returns `Promise.resolve()` if unavailable.
- `withNamespace(child)` → nested namespacing: `namespace:child:` against the same base adapter.

## 4. Memory Adapter (`adapters/memory.js`)

LRU in-memory cache using `Map` insertion order for eviction.

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
- **`set(key, value, ttl?)`**: Removes existing entry first (for reordering). While `size >= maxSize`, evicts the oldest entry (`Map.keys().next().value`). Then inserts.
- **`has(key)`**: Returns `false` for expired entries (lazy deletion).

### Stats Shape

```javascript
{ type: 'memory', totalEntries, validEntries, expiredEntries, maxSize, defaultTTL }
```

### Cleanup

Iterates all entries, deletes expired ones. Returns count of removed entries.

## 5. File Adapter (`adapters/file.js`)

Filesystem-backed cache with persistent storage across restarts.

### Configuration

| Option | Default | Description |
|---|---|---|
| `directory` | `~/.rsk/caches` | Cache directory path |
| `maxSize` | `10000` | Maximum cache files |
| `ttl` | `300000` (5 min) | Default TTL in milliseconds |

### File Format

Each entry stored as `<md5(key)>.json`:
```javascript
{ key: string, value: any, expiresAt: number, createdAt: number }
```

- **Key hashing**: `crypto.createHash('md5').update(key).digest('hex')`
- **Atomic writes**: Write to `<filename>.tmp.<timestamp>`, then `fs.renameSync`.

### Concurrency Control

Spin lock per key (`acquireLock(key, timeout=5000)`). All `get`, `set`, `delete`, `has` operations acquire/release locks. The lock is a simple `Map<key, timestamp>`.

### LRU-like Eviction

`evictIfNeeded()` triggers when file count reaches `maxSize`:
1. Reads all cache files, parses their `createdAt`.
2. Sorts by `createdAt` ascending.
3. Removes oldest **10%** (minimum 1 entry).

### `keys()` Behavior

Reads all `.json` files, parses each to extract the original `key` field. This is **synchronous** and reads every file. Returns only keys from parseable files.

### Cleanup

Removes expired files and corrupted (unparseable) files. Also cleans stale locks older than 30 seconds.

### Stats Shape

```javascript
{ type: 'file', directory, totalEntries, validEntries, expiredEntries, maxSize, defaultTTL, activeLocks }
```

## 6. NoOp Adapter (`adapters/noop.js`)

Development-mode passthrough. Automatically selected when `__DEV__` is truthy.

| Method | Returns |
|---|---|
| `get()` | `null` |
| `set()` | `undefined` |
| `delete()` | `true` |
| `has()` | `false` |
| `clear()` | `undefined` |
| `keys()` | `[]` |
| `stats()` | `{ entries: 0, hits: 0, misses: 0 }` |
| `cleanup()` | `Promise.resolve()` |
| `size` | `0` |

## 7. Default Singleton

**File:** `index.js`

### Named Exports
- `createFactory` — create custom instances
- `withNamespace` — standalone namespace wrapper

### Default Export
```javascript
const cache = createFactory({
  type: 'memory',
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

The singleton is registered on the DI container as `container.resolve('cache')` during engine autoloading. In `__DEV__` mode, this will be a `NoOpCache` regardless of the options.

## 8. Error Handling

| Error Name | Status | Thrown By | When |
|---|---|---|---|
| `InvalidCacheTypeError` | `400` | `createFactory` | Unknown adapter type (production only) |
| `InvalidNamespaceError` | `400` | `withNamespace` | Empty, whitespace, or >100 char namespace |
| `InvalidCacheError` | `400` | `withNamespace` | Missing or invalid base cache |

## 9. Testing

**File:** `cache.test.js` (411 lines)

### Test Coverage (6 describe blocks)

**Default Instance:**
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

**withNamespace():**
- Creates from default instance.
- Key prefixing (`users:123`).
- Isolation between namespaces.
- Clear only namespaced keys.
- Works with custom base cache.
- Stats delegation.
- Cleanup delegation.

**LRU Eviction:**
- Evicts least recently used on `get()` access.
- Updates LRU order on `set()` update.

## 10. Integration Points

- **Module `init(container)`**: Access via `container.resolve('cache')`. Use `withNamespace()` to scope by module.
- **`__DEV__` global**: When truthy, all `createFactory` calls produce `NoOpCache` — ensures fresh data during development.
- **Schedule engine**: Can pair with scheduled `cleanup()` calls for periodic expired-entry removal.

---

*Note: This spec reflects the CURRENT implementation of the cache engine.*
