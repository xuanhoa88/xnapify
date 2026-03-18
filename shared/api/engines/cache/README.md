# Cache Engine

Key-value caching with multiple adapter support (memory, file) and automatic namespace isolation. Auto-disabled in development mode via a NoOp adapter.

## Quick Start

```javascript
import cache from '@shared/api/engines/cache';

await cache.set('key', 'value', 60000); // 60s TTL
const value = await cache.get('key');
await cache.delete('key');
```

## API

### Core Methods

| Method | Signature | Description |
|---|---|---|
| `get` | `(key) → Promise<any>` | Get value by key |
| `set` | `(key, value, ttl?) → Promise<void>` | Set value with optional TTL (ms) |
| `delete` | `(key) → Promise<boolean>` | Delete key |
| `has` | `(key) → Promise<boolean>` | Check if key exists |
| `clear` | `() → Promise<void>` | Clear all entries |
| `keys` | `() → string[]` | Get all keys (adapter-dependent) |
| `stats` | `() → Object` | Cache statistics |
| `cleanup` | `() → Promise<void>` | Cleanup expired entries |

### Namespacing

```javascript
const userCache = cache.withNamespace('users');
await userCache.set('123', userData); // Stored as "users:123"

// Nested namespaces
const apiUserCache = cache.withNamespace('api').withNamespace('users');
await apiUserCache.set('123', data); // Stored as "api:users:123"
```

### Custom Instances

```javascript
import { createFactory } from '@shared/api/engines/cache';

const fileCache = createFactory({ type: 'file', directory: '/tmp/cache' });
const memCache = createFactory({ type: 'memory', maxSize: 500, ttl: 300000 });
```

## Adapters

| Type | Class | Description |
|---|---|---|
| `memory` | `MemoryCache` | In-memory LRU cache (default) |
| `file` | `FileCache` | File-system backed cache |
| `noop` | `NoOpCache` | No-op adapter (auto-used in `__DEV__`) |

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
