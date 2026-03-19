# Search Engine

Full-text search with pluggable adapters (memory, database) and namespace isolation for multi-module search. Lazy-initialized to avoid bootstrap ordering issues.

## Quick Start

```javascript
const search = container.resolve('search');

// Index a document
await search.index({
  entityType: 'post',
  entityId: '1',
  title: 'Hello World',
  content: 'Full article text...',
  tags: 'intro welcome',
  url: '/posts/1',
  priority: 5,
});

// Search
const results = await search.search('hello', { limit: 10, offset: 0 });

// Remove
await search.remove('post', '1');
```

## API

### Core Methods

| Method | Returns | Description |
|---|---|---|
| `index(document)` | `Promise<void>` | Add or update a document |
| `search(query, options?)` | `Promise<Array>` | Full-text search |
| `remove(entityType, entityId)` | `Promise<boolean>` | Remove from index |
| `clear(prefix?)` | `Promise<void>` | Clear all or namespace-prefixed documents |
| `withNamespace(name)` | `NamespacedSearch` | Create isolated namespace wrapper |

### Search Document

| Field | Type | Default | Description |
|---|---|---|---|
| `entityType` | `string` | *required* | Entity type (e.g. `'post'`, `'product'`) |
| `entityId` | `string\|number` | *required* | Unique ID |
| `title` | `string` | — | Searchable title |
| `content` | `string` | — | Searchable body text |
| `tags` | `string` | — | Searchable tags (space/comma separated) |
| `url` | `string` | — | Link to entity |
| `priority` | `number` | `0` | Ranking weight (higher = ranked first) |
| `popularity` | `number` | `0` | Ranking weight |
| `visibility` | `string` | `'public'` | Visibility state |

### Search Options

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `20` | Max results |
| `offset` | `number` | `0` | Pagination offset |
| `entityType` | `string` | — | Filter by entity type |

### Namespacing

Isolate modules with namespace prefixing:

```javascript
const blogSearch = search.withNamespace('blog');
await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
// Stored as entityType='blog:post' — isolated from other modules

// Nested namespacing supported
const draftSearch = blogSearch.withNamespace('drafts');
// entityType becomes 'blog:drafts:post'
```

## Adapters

| Type | Description | Config |
|---|---|---|
| `memory` | File-backed in-memory search (default) | `{ directory?: string }` (default: `~/.rsk/fts`) |
| `database` | Native FTS — SQLite FTS5, PostgreSQL tsvector, MySQL FULLTEXT | `{ connection, DataTypes }` (auto-injected) |

Configure via `RSK_SEARCH_TYPE` env var (`'memory'` or `'database'`).

### Database Adapter — Dialect Support

| Dialect | FTS Method | Ranking | Highlighting |
|---|---|---|---|
| SQLite | FTS5 `MATCH` | `bm25()` | `snippet()` |
| PostgreSQL | `tsvector` + `websearch_to_tsquery` | `ts_rank()` | `ts_headline()` |
| MySQL/MariaDB | `MATCH() AGAINST()` boolean mode | Relevance score | Substring |
| Other | `LIKE` / `iLike` fallback | priority + popularity | Substring |

### Custom Adapters

```javascript
import { registerAdapter, createFactory } from '@shared/api/engines/search';

class ElasticSearchAdapter {
  constructor(options) { /* ... */ }
  async index(document) { /* ... */ }
  async search(query, options) { /* ... */ }
  async remove(entityType, entityId) { /* ... */ }
  async clear(prefix) { /* ... */ }
}

registerAdapter('elasticsearch', ElasticSearchAdapter);
const esSearch = createFactory({ type: 'elasticsearch', nodes: ['http://localhost:9200'] });
```

### Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/search';
const custom = createFactory({ type: 'memory', directory: '/tmp/search' });
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
