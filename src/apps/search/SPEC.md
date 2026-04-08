# Search Module AI Specification

> **Instructions for the AI:**
> Read this document to understand the full-text search architecture inside `src/apps/search`.
> This module owns the search engine: model, migration, database adapter, factory, and API routes.

---

## Objective

Provide a unified, database-backed full-text search interface across all system entities (users, groups, files, etc.) using native FTS capabilities of the connected database engine. The search module owns the `SearchDocument` model, manages adapter registration for extensibility, and exposes a namespace-isolated search API via the DI container.

## 1. Architecture

```
src/apps/search/
├── package.json
├── SPEC.md                              # This file
├── README.md                            # Module instructions
└── api/
    ├── index.js                         # Lifecycle hooks (migrations, models, providers, boot, routes)
    ├── factory.js                       # createFactory(), registerAdapter(), withNamespace()
    ├── hooks.js                         # search:indexers hook registration
    ├── hooks.test.js                    # Hook tests
    ├── adapters/
    │   └── database.js                  # Native FTS adapter (SQLite, PostgreSQL, MySQL, fallback)
    ├── models/
    │   └── SearchDocument.js            # Sequelize model factory
    ├── database/
    │   └── migrations/
    │       └── 2026.04.08T00.00.00.create-search-documents-table.js
    ├── controllers/
    │   └── search.controller.js         # GET /api/search endpoint
    └── routes/
        └── (default)/
            └── _route.js                # Route definition with auth guard
```

### Dependency Graph

```
api/index.js
├── factory.js
│   └── adapters/database.js (sequelize model)
├── hooks.js
├── models/ (require.context → autoloader)
├── database/migrations/ (require.context → autoloader)
└── routes/ (require.context → autoloader)
```

## 2. Data Types

### `SearchDocument` Model

Sequelize model defined in `models/SearchDocument.js`. Table: `search_documents`.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | Auto-increment | Primary key |
| `entity_type` | STRING(255) | No | — | Entity type (e.g. 'user', 'group') |
| `entity_id` | STRING(255) | No | — | Unique per entity_type |
| `title` | TEXT | Yes | — | Searchable title |
| `content` | TEXT | Yes | — | Searchable body content |
| `tags` | TEXT | Yes | — | Searchable tags (space/comma separated) |
| `url` | TEXT | Yes | — | Link to entity |
| `priority` | INTEGER | No | 0 | Ranking weight (higher = first) |
| `popularity` | INTEGER | No | 0 | Popularity metric |
| `visibility` | STRING(50) | No | 'public' | Visibility state |
| `created_at` | DATE | No | NOW | Created timestamp |
| `updated_at` | DATE | No | NOW | Updated timestamp |

**Indexes:**
- Unique composite: `(entity_type, entity_id)`
- Secondary: `entity_type` (for namespace prefix queries)

### `SearchAdapter` Interface

Custom adapters must implement:

| Method | Signature | Description |
|---|---|---|
| `index(document)` | `(SearchDocument) → Promise<void>` | Add or update a document |
| `search(query, options?)` | `(string, { limit?, offset?, entityType? }) → Promise<Array>` | Full-text search |
| `remove(entityType, entityId)` | `(string, string\|number) → Promise<boolean>` | Remove from index |
| `clear(prefix?)` | `(string?) → Promise<void>` | Clear all or prefixed documents |
| `count(prefix?)` | `(string?) → Promise<number>` | Count all or prefixed documents |

## 3. Factory (`factory.js`)

### Adapter Registry

A shared `Map` pre-loaded with `'database'` → `DatabaseSearch`. Extensions can add custom adapters.

### `registerAdapter(name, AdapterClass)`

Registers a custom adapter class in the shared registry. **Overwrites** existing adapters.

- Throws `Error` if name is falsy/non-string.
- Throws `Error` if AdapterClass is not a function.
- Exposed to extensions via `container.resolve('search:registerAdapter')`.

### `createFactory(options?) → SearchAdapter`

Creates and returns a new adapter instance.

1. Reads `type` from options (default: `'database'`).
2. Looks up adapter class from registry. Throws `InvalidSearchTypeError` (status 400) if not found.
3. Instantiates adapter with remaining options.
4. Attaches `withNamespace()` method to the adapter instance.

### `withNamespace(namespace, baseSearch) → NamespacedSearch`

Creates a wrapper that prefixes all `entityType` values with `namespace:`.

**Behavior:**
- `index(doc)` → prepends `namespace:` to `doc.entityType`.
- `search(query, opts)` → prepends `namespace:` to `opts.entityType` if present.
- `remove(entityType, entityId)` → prepends `namespace:` to entityType.
- `clear()` → calls `baseSearch.clear(prefix)` where prefix = `namespace:`.
- `count()` → calls `baseSearch.count(prefix)` where prefix = `namespace:`.
- `withNamespace(child)` → nested namespacing: creates `namespace:child:` prefix.

## 4. Database Adapter (`adapters/database.js`)

Native full-text search using the connected database engine's FTS capabilities.

### Configuration

| Option | Description |
|---|---|
| `model` | Sequelize SearchDocument model (required, auto-injected by factory) |

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

### Count Behavior

`SELECT COUNT(*)` from `search_documents` with optional `entity_type LIKE 'prefix%'` filter for namespace scoping.

### Clear Behavior

- Without prefix: `TRUNCATE` (via `truncate: true`).
- With prefix: `DELETE WHERE entityType LIKE 'prefix%'`.

## 5. Module Lifecycle (`api/index.js`)

### Lifecycle Phases

| Phase | Hook | Description |
|---|---|---|
| `migrations` | `() => migrationsContext` | Creates `search_documents` table |
| `models` | `() => modelsContext` | Registers `SearchDocument` model |
| `providers` | `providers({ container })` | Binds `'search'` (lazy factory) and `'search:registerAdapter'` |
| `boot` | `boot({ container })` | Emits `search:indexers` register hook |
| `routes` | `() => routesContext` | Mounts `GET /api/search` |

### Adapter Type Resolution (3-tier)

When `container.resolve('search')` is called, the lazy factory resolves the adapter type:

1. **`search:type` DI binding** — set by extension via `container.instance('search:type', 'elasticsearch')`
2. **`XNAPIFY_SEARCH_TYPE` env var** — set in `.env` or environment
3. **`'database'` fallback** — default built-in adapter

Extensions can also provide adapter options via `container.instance('search:options', { ... })`.

## 6. API Routes & Controllers

- **Method & Path:** `GET /api/search`
  - **Security:** Requires `authenticated` level.
  - **Parameters:**
    - `q`: Search query string (Required).
    - `entityType`: Filter by specific model (e.g., `User`).
    - `namespace`: Filter by application domain (e.g., `files`).
    - `limit` / `offset`: Pagination controls.
  - **Logic:** Dispatches query to the search engine and returns ranked, deduplicated results.

## 7. Extension Integration

Extensions can register custom search adapters:

```javascript
// In extension providers()
async providers({ container }) {
  const registerAdapter = container.resolve('search:registerAdapter');
  registerAdapter('elasticsearch', ElasticSearchAdapter);

  // Set as default — container.resolve('search') returns Elasticsearch
  container.instance('search:type', 'elasticsearch');
  container.instance('search:options', { nodes: ['http://localhost:9200'] });
}
```

## 8. Error Handling

| Error Name | Status | Thrown By | When |
|---|---|---|---|
| `Error` | — | `registerAdapter` | Invalid name or non-function class |
| `InvalidSearchTypeError` | `400` | `createFactory` | Unknown adapter type |
| `InvalidNamespaceError` | `400` | `withNamespace` | Invalid namespace |
| `InvalidSearchError` | `400` | `withNamespace` | Missing base search adapter |
| `Error` | — | `index()` | Missing `entityType` or `entityId` |

## 9. Integration Points

- **Module `boot({ container })`**: Access via `container.resolve('search')`. Use `withNamespace()` to avoid collisions.
- **Hook engine**: The search module listens for `search:indexers` hooks to trigger index registration.
- **Consumer modules**: Users and Groups modules call `search.withNamespace('users').count()` and `indexAllUsers()` during boot.

---

*Note: This spec reflects the CURRENT implementation of the database-backed search module.*
