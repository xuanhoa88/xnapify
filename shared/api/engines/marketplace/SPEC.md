# Marketplace Engine — Technical Specification

## Overview

The `marketplace` engine provides a lightweight HTTP client for connecting to a remote Extension Marketplace registry. Consumer xnapify instances use it to browse, search, and install extensions from a shared marketplace.

## Architecture

```
shared/api/engines/marketplace/
└── index.js    # MarketplaceClient class + singleton + factory
```

## MarketplaceClient API

### Configuration

| Property | Source | Default | Description |
|---|---|---|---|
| `registryUrl` | `XNAPIFY_MARKETPLACE_URL` | `''` (disabled) | Remote registry base URL |
| `apiKey` | `XNAPIFY_MARKETPLACE_API_KEY` | `''` | Optional API key for auth |
| `timeout` | constructor option | `30000` | Request timeout in ms |

The engine is disabled when `registryUrl` is empty. All public methods throw an error if called without configuration.

### `isConfigured` → `boolean`

Returns whether the engine has a registry URL set.

### `configure(options)` → `void`

Updates configuration at runtime (registryUrl, apiKey, timeout).

### Catalog Methods

| Method | Returns | Description |
|---|---|---|
| `browse(params?)` | `{ listings, total, page, totalPages }` | Browse marketplace with optional `search`, `category`, `sort`, `page`, `limit` params |
| `getFeatured(limit?)` | `Array` | Get featured extension listings |
| `getCategories()` | `Array` | Get categories with counts |
| `getDetail(id)` | `Object` | Get full listing details by UUID |
| `download(id)` | `Buffer` | Download extension package as raw buffer |
| `install(id, extensionManager)` | `Object` | Download and install via `extensionManager.installFromBuffer()` |

### HTTP Helpers

| Method | Auth Header | Content-Type | Description |
|---|---|---|---|
| `fetchJSON(path)` | `X-Marketplace-Key` | `application/json` | GET returning parsed JSON |
| `fetchRaw(path)` | `X-Marketplace-Key` | `application/octet-stream` | GET returning raw buffer |

Error responses include the remote error message when available.

## Exports

| Export | Type | Description |
|---|---|---|
| `default` | `MarketplaceClient` | Singleton instance (configured from env vars) |
| `createMarketplaceClient(options)` | `Function` | Factory for custom instances |

## Container Registration

Registered as `container.resolve('marketplace')` by the engine auto-discovery system. No `withContext()` needed — the engine is self-contained.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `XNAPIFY_MARKETPLACE_URL` | No | Remote marketplace registry URL |
| `XNAPIFY_MARKETPLACE_API_KEY` | No | API key for authenticated marketplace requests |

---

*Note: This spec reflects the CURRENT implementation of the marketplace engine.*
