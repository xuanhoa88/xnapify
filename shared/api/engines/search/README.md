# Search Engine

Full-text search with pluggable adapters (memory, database) and namespace isolation for multi-module search.

## Quick Start

```javascript
const search = app.get('search');

await search.index({
  entityType: 'post',
  entityId: '1',
  title: 'Hello World',
  content: 'Full article text...',
});

const results = await search.search('hello');
await search.remove('post', '1');
```

## API

### Core Methods

| Method | Description |
|---|---|
| `index({ entityType, entityId, title, content })` | Index a document |
| `search(query, options?)` | Full-text search |
| `remove(entityType, entityId)` | Remove from index |

### Namespacing

```javascript
const blogSearch = search.withNamespace('blog');
await blogSearch.index({ entityType: 'post', entityId: '1', title: 'Hello' });
// Stored as entityType='blog:post' — isolated from other modules
```

### Custom Adapters

```javascript
import { registerAdapter, createFactory } from '@shared/api/engines/search';

registerAdapter('elasticsearch', MyElasticAdapter);
const esSearch = createFactory({ type: 'elasticsearch', nodes: ['http://localhost:9200'] });
```

## Adapters

| Type | Description |
|---|---|
| `memory` | File-backed in-memory search (default) |
| `database` | Native FTS — SQLite FTS5, PostgreSQL tsvector, MySQL FULLTEXT |

Configure via `RSK_SEARCH_TYPE` env var.

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
