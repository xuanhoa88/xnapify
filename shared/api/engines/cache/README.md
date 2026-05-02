# Cache Engine

Key-value caching with pluggable adapters (memory, file), namespace isolation, LRU eviction, and TTL-based expiration. Automatically disabled in development mode via a NoOp adapter.

## Quick Start

```javascript
const cache = container.resolve('cache');

await cache.set('key', 'value', 60000); // 60s TTL
const value = await cache.get('key'); // 'value' or null
await cache.delete('key'); // true/false
```

> **Note:** In `__DEV__` mode, all cache operations are no-ops to ensure fresh data.

## API

### Core Methods

| Method                  | Returns         | Description                                        |
| ----------------------- | --------------- | -------------------------------------------------- |
| `get(key)`              | value or `null` | Get value (null if missing or expired)             |
| `set(key, value, ttl?)` | `void`          | Set value with optional TTL in ms (default: 5 min) |
| `delete(key)`           | `boolean`       | Delete key                                         |
| `has(key)`              | `boolean`       | Check if key exists and not expired                |
| `clear()`               | `void`          | Clear all entries                                  |
| `keys()`                | `string[]`      | Get all cache keys                                 |
| `stats()`               | `object`        | Cache statistics                                   |
| `cleanup()`             | `number`        | Remove expired entries, returns count              |
| `size`                  | `number`        | Current entry count                                |

> **Note:** File cache methods are async (return Promises). Memory cache methods are synchronous.

### Namespacing

Isolate modules with key prefixing:

```javascript
const userCache = cache.withNamespace('users');
await userCache.set('123', userData); // Stored as "users:123"

// Nested namespaces
const apiUserCache = cache.withNamespace('api').withNamespace('users');
await apiUserCache.set('123', data); // Stored as "api:users:123"

// clear() only removes keys within the namespace
userCache.clear(); // Removes "users:*", leaves "posts:*" etc.
```

## Adapters

| Type     | Class         | Default `maxSize` | Default Dir                                            | Description                                    |
| -------- | ------------- | ----------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `memory` | `MemoryCache` | `1000`            | —                                                      | In-memory LRU cache (default)                  |
| `file`   | `FileCache`   | `10000`           | `~/.xnapify/caches` (prod)<br/>`.xnapify/caches` (dev) | File-system backed, persistent across restarts |
| `noop`   | `NoOpCache`   | —                 | —                                                      | No-op (auto-selected in `__DEV__` mode)        |

### Memory Adapter

- **LRU eviction**: Oldest entries removed when `maxSize` reached.
- **Lazy expiration**: Expired entries deleted on `get()` / `has()` access.
- Access (`get`) and update (`set`) refresh LRU position.
- **Synchronous** operations.

### File Adapter

- Each key stored as `<sha256-hash>.json` with atomic writes (temp + rename).
- **Async mutex per key** — no busy-wait, Promise-based operation queuing.
- Eviction removes oldest **10%** of files when `maxSize` reached.
- `cleanup()` also removes corrupted files.
- **All operations are async** (use `await`).

### Custom Instances

```javascript
import { createFactory } from '@shared/api/engines/cache';

const fileCache = createFactory({ type: 'file', directory: '/tmp/cache' });
const memCache = createFactory({ type: 'memory', maxSize: 500, ttl: 10000 });
```

## Error Classes

```javascript
import {
  CacheError,
  InvalidCacheTypeError,
  InvalidNamespaceError,
} from '@shared/api/engines/cache';
```

| Class                   | Code                 | Status | When                       |
| ----------------------- | -------------------- | ------ | -------------------------- |
| `CacheError`            | `CACHE_ERROR`        | `500`  | Base error                 |
| `InvalidCacheTypeError` | `INVALID_CACHE_TYPE` | `400`  | Unknown adapter type       |
| `InvalidNamespaceError` | `INVALID_NAMESPACE`  | `400`  | Invalid namespace          |
| `InvalidCacheError`     | `INVALID_CACHE`      | `400`  | Missing/invalid base cache |

## Graceful Shutdown

`createFactory()` registers cleanup with the centralized shutdown registry (`shared/api/shutdown.js`). The `adapter.cleanup()` method is called automatically during coordinated process shutdown — no manual signal handling needed.

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
