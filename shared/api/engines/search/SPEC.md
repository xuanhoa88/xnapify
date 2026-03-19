# Search Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Search Engine at `shared/api/engines/search`.
> This engine provides full-text search with pluggable adapters, namespace isolation, and lazy initialization.

---

## Objective

Provide a full-text search layer with pluggable backend adapters (memory, database), namespace isolation for multi-module search, and lazy initialization via Proxy to avoid bootstrap ordering issues.

## 1. Architecture

```
shared/api/engines/search/
├── index.js              # Lazy-initialized singleton via Proxy
├── factory.js            # createFactory(), registerAdapter(), withNamespace()
└── adapters/
    ├── memory.js         # File-backed in-memory search
    └── database.js       # Native FTS (SQLite FTS5, PostgreSQL tsvector, MySQL FULLTEXT)
```

### Dependency Graph

```
index.js
└── factory.js
    ├── adapters/memory.js (fs, os, path)
    └── adapters/database.js (sequelize)
```

No error classes file — errors are thrown inline with custom `name` and `status` properties.

## 2. Data Types

### `SearchDocument`

```javascript
{
  entityType: string,       // Required — e.g. 'post', 'product'
  entityId: string|number,  // Required — unique per entityType
  title: string,            // Optional — searchable
  content: string,          // Optional — searchable
  tags: string,             // Optional — searchable (comma/space separated)
  url: string,              // Optional — link to entity
  priority: number,         // Optional, default 0 — ranking weight
  popularity: number,       // Optional, default 0 — ranking weight
  visibility: string,       // Optional, default 'public'
}
```

### `SearchAdapter` Interface

Custom adapters must implement:

| Method | Signature | Description |
|---|---|---|
| `index(document)` | `(SearchDocument) → Promise<void>` | Add or update a document |
| `search(query, options?)` | `(string, { limit?, offset?, entityType? }) → Promise<Array>` | Full-text search |
| `remove(entityType, entityId)` | `(string, string\|number) → Promise<boolean>` | Remove from index |
| `clear(prefix?)` | `(string?) → Promise<void>` | Clear all or prefixed documents |

## 3. Factory (`factory.js`)

### Module-Level Adapter Registry

A shared `Map` pre-loaded with `'memory'` → `MemorySearch` and `'database'` → `DatabaseSearch`. Shared across all `createFactory` calls.

### `registerAdapter(name, AdapterClass)`

Registers a custom adapter class in the shared registry. **Overwrites** existing adapters (unlike queue engine which refuses overrides).

- Throws `Error` if name is falsy/non-string.
- Throws `Error` if AdapterClass is not a function.

### `createFactory(options?) → SearchAdapter`

Creates and returns a new adapter instance.

1. Resolves adapter type: `options.type` → `RSK_SEARCH_TYPE` env var → `'memory'` fallback.
2. Looks up adapter class from registry. Throws `InvalidSearchTypeError` (status 400) if not found.
3. For `'database'` type: validates that `options.connection` exists, throws `InvalidSearchDatabaseAdapterError` (status 400) if missing.
4. Instantiates adapter with `configOptions` (options minus `type`).
5. Attaches `withNamespace()` method to the adapter instance.

### `withNamespace(namespace, baseSearch) → NamespacedSearch`

Creates a wrapper that prefixes all `entityType` values with `namespace:`.

**Validation:**
- Throws `InvalidNamespaceError` (status 400) if namespace is falsy/non-string.
- Throws `InvalidSearchError` (status 400) if baseSearch lacks a `search` method.

**Behavior:**
- `index(doc)` → prepends `namespace:` to `doc.entityType`.
- `search(query, opts)` → prepends `namespace:` to `opts.entityType` if present, otherwise searches all.
- `remove(entityType, entityId)` → prepends `namespace:` to entityType.
- `clear()` → calls `baseSearch.clear(prefix)` where prefix = `namespace:`.
- `withNamespace(child)` → **nested namespacing**: creates `namespace:child:` prefix against the same base adapter.

## 4. Memory Adapter (`adapters/memory.js`)

File-backed in-memory search. Documents stored in a `Map` in-process and persisted as individual JSON files on disk.

### Configuration

| Option | Default | Description |
|---|---|---|
| `directory` | `~/.rsk/fts` | Directory for JSON document files |

### Initialization

1. Creates directory synchronously at construction (`mkdirSync`).
2. Asynchronously loads all `.json` files into `memoryIndex` Map.
3. All public methods call `_waitForInitialization()` which awaits the init promise.

### Concurrency Control

Per-key write queues (`_enqueue(key, task)`) ensure writes to the **same** file are sequential, while writes to different files run in parallel. Queue chains via `.catch(() => {}).then(() => task())` — previous errors are swallowed so the queue continues.

### Search Algorithm

- Case-insensitive `includes()` match across `title`, `content`, and `tags`.
- Results ranked by `priority * 10 + popularity` (descending).
- Pagination via `limit` (default 20) and `offset` (default 0).
- Results include a `snippet` (first 100 chars of content), `fullContent`, and `rank`.

### File Persistence

- **Index:** Atomic write via temp file + `fs.rename`.
- **Remove:** `fs.unlink` with ENOENT silenced.
- **Clear:** Parallel file removal via `Promise.all`, optionally filtered by prefix.

### Document Key Format

`${entityType}_${entityId}` — used for both Map key and filename (`<key>.json`).

## 5. Database Adapter (`adapters/database.js`)

Native full-text search using the connected database engine's FTS capabilities. Requires a Sequelize connection.

### Configuration

| Option | Description |
|---|---|
| `connection` | Sequelize connection instance (required, auto-injected) |
| `DataTypes` | Sequelize DataTypes (required, auto-injected) |

### Model: `search_documents`

Sequelize model with `entityType`, `entityId`, `title`, `content`, `tags`, `url`, `priority`, `popularity`, `visibility`. Uses `underscored: true` and `timestamps: true`.

### Dialect-Specific Search Strategies

| Dialect | Strategy | Ranking | Highlighting |
|---|---|---|---|
| **SQLite** | FTS5 virtual table (`search_fts`) + `MATCH` | `bm25()` | `snippet()` with `<b>` tags |
| **PostgreSQL** | `tsvector` column + `GIN` index + `websearch_to_tsquery` | `ts_rank()` | `ts_headline()` with `<b>` tags |
| **MySQL/MariaDB** | `FULLTEXT` index + `MATCH() AGAINST()` boolean mode | Relevance score | `SUBSTRING(content, 1, 100)` |
| **Fallback** | `LIKE` / `iLike` on title, content, tags | `priority DESC, popularity DESC` | `content.substring(0, 100)` |

**Note:** All SQL queries use `:parameterized` replacements (not string interpolation) for safety.

### Index Behavior

Uses `findOrCreate` — upserts by `(entityType, entityId)` unique pair.

### Clear Behavior

- Without prefix: `TRUNCATE` (via `truncate: true`).
- With prefix: `DELETE WHERE entityType LIKE 'prefix%'`.

## 6. Lazy Proxy Singleton

**File:** `index.js`

### Named Exports
- `createFactory` — create custom instances
- `registerAdapter` — register adapters in the shared registry
- `withNamespace` — standalone namespace wrapper

### Default Export

A `Proxy` object that lazily calls `createFactory()` on first property access:

```javascript
let searchInstance = null;

function getSearchInstance() {
  if (!searchInstance) {
    searchInstance = createFactory();
  }
  return searchInstance;
}

const search = new Proxy({}, {
  get(_, prop) {
    const instance = getSearchInstance();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
```

**Why Proxy?** Prevents database connection issues during module bootstrap. The adapter is not created until the first `search.index()` or `search.search()` call, by which time DB connections are ready.

The singleton is registered on the DI container as `app.get('container').resolve('search')` during engine autoloading.

## 7. Error Handling

No dedicated error classes file. Errors thrown inline:

| Error Name | Status | Thrown By | When |
|---|---|---|---|
| `Error` | — | `registerAdapter` | Invalid name or non-function class |
| `InvalidSearchTypeError` | `400` | `createFactory` | Unknown adapter type |
| `InvalidSearchDatabaseAdapterError` | `400` | `createFactory` | Database type without connection |
| `InvalidNamespaceError` | `400` | `withNamespace` | Invalid namespace |
| `InvalidSearchError` | `400` | `withNamespace` | Missing base search adapter |
| `Error` | — | `index()` | Missing `entityType` or `entityId` |

## 8. Integration Points

- **Module `init(app)`**: Access via `app.get('container').resolve('search')`. Use `withNamespace()` to avoid collisions.
- **Hook engine**: The search module listens for user/group hooks to update indexes.
- **`RSK_SEARCH_TYPE`**: Environment variable to switch default adapter (`'memory'` or `'database'`).
- **DB engine**: The database adapter requires `connection` and `DataTypes` from the DB engine. The factory auto-injects these during bootstrap.

---

*Note: This spec reflects the CURRENT implementation of the search engine.*
