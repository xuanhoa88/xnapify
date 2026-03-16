# Shared Fetch

A unified, isomorphic HTTP client built on top of the native `fetch` API. It provides a structured pipeline with hooks, sensible defaults for JSON serialization, auto-retry mechanisms, and enhanced error handling.

## Quick Start

```javascript
import { createFetch } from '@shared/fetch';

// Create a configured fetch instance
const $fetch = createFetch(fetch, {
  defaults: {
    baseUrl: 'https://api.example.com',
    headers: {
      Authorization: 'Bearer token',
    },
  },
});

// GET request with query params
const data = await $fetch('/users', {
  query: { active: true, page: 1 },
});

// POST request with JSON body (auto-serialized)
const user = await $fetch('/users', {
  method: 'POST',
  body: { name: 'Alice', email: 'alice@example.com' },
});
```

## Features

- **Isomorphic**: Works flawlessly on both browser and Node.js.
- **Auto-Serialization**: Automatically stringifies standard objects to JSON and sets `Content-Type: application/json`.
- **Response Parsing**: Automatically detects `Content-Type` and parses the response (JSON, Text, Blob, Stream).
- **URL & Query Builder**: Merges `baseUrl` and dynamically constructs query strings from objects.
- **Hook Lifecycle**: Tap into `onRequest`, `onResponse`, `onRequestError`, and `onResponseError`.
- **Retry Mechanism**: Built-in, configurable retry logic for transient errors (e.g., 502, 503, 504, 429).
- **Timeout Support**: Simple `timeout: ms` option utilizing `AbortSignal.timeout` or a polyfill.
- **Detailed Errors**: Structured `FetchError` class capturing HTTP status, request context, and backend error messages.

## Usage Guide

### Instantiation

```javascript
const myFetch = createFetch(globalThis.fetch, {
  defaults: { /* global default options */ }
});
```

The returned `$fetch` instance has additional properties:
- `$fetch.raw(input, options)`: Returns the complete `Response` object instead of just the data payload.
- `$fetch.native(input, options)`: Bypasses to the original native `fetch`.
- `$fetch.create(defaults)`: Creates a new cloned instance extending the current configuration.

### Options

| Option | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Base path prepended to all string requests |
| `query` / `params` | `Object` | Key-value pairs appended as a query string |
| `body` | `*` | Request payload. Objects/Arrays are auto-JSON serialized. |
| `timeout` | `number` | Abort timeout in milliseconds |
| `retry` | `number` \| `false` | Number of retry attempts. Defaults to `1` for GET/HEAD, `0` for payload methods. |
| `retryDelay` | `number` \| `Function` | Delay between retries in milliseconds |
| `responseType` | `string` | Force response parsing type (`json`, `text`, `blob`, `stream`) |

### Hooks

Options can define async hook functions:

```javascript
const $fetch = createFetch(fetch, {
  defaults: {
    onRequest({ request, options }) {
      console.log(`[Fetch] -> ${request}`);
    },
    onResponse({ request, response }) {
      console.log(`[Fetch] <- ${response.status} ${request}`);
    },
    onResponseError({ request, response, error }) {
      console.error(`[Fetch Error] ${error.message}`);
    }
  }
});
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
