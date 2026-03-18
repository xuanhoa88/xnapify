# Search Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Search Engine at `shared/api/engines/search`.

---

## Objective

Provide a full-text search layer with pluggable adapters, namespace isolation, and lazy initialization.

## 1. Architecture

```
shared/api/engines/search/
├── index.js          # Lazy-initialized singleton via Proxy
├── factory.js        # createFactory(), registerAdapter(), withNamespace()
└── adapters/         # Backend adapters (memory, database)
```

## 2. Factory (`factory.js`)

- `createFactory(options?)` — creates search instance. Default type from `RSK_SEARCH_TYPE` env var.
- `registerAdapter(name, Adapter)` — register custom search backends.
- `withNamespace(namespace)` — creates namespaced search that prefixes `entityType` with `namespace:`.

## 3. Lazy Initialization

The default singleton uses a `Proxy` to defer `createFactory()` until first property access. This prevents DB connection issues during module bootstrap.

## 4. Default Singleton

Registered on DI as `app.get('search')`.

---

*Note: This spec reflects the CURRENT implementation of the search engine.*
