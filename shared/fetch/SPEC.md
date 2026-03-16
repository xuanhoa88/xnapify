# Shared Fetch — Technical Specification

## Overview

The `shared/fetch/` library provides an isomorphic HTTP data fetching wrapper built around the standard Fetch API. It implements a plugin-like lifecycle architecture to intercept, transform, and handle requests and responses universally across the server and client.

## Architecture

```
shared/fetch/
├── index.js      # Public API exports
├── factory.js    # Core `$fetch` factory & request pipeline
├── error.js      # Custom `FetchError` class implementation
└── utils.js      # Payload, parameter merging, URL manipulations, and header utils
```

## Pipeline Lifecycle (`factory.js`)

When a request is initiated via `$fetch` (or `$factory` internally):

1. **Context Initialization**: A mutable `context` object is created:
   ```javascript
   { request, options, response, error }
   ```
2. **Options Resolution**: `resolveFetchOptions()` merges input options with instance `defaults`. Headers are normalized into plain lowercase objects.
3. **`onRequest` Hook**: Called immediately after context resolution.
4. **URL Normalization**: 
   - `withBase(request, baseUrl)` is applied.
   - `withQuery(request, query)` appends parameters to the URL search string.
5. **Body Serialization**: 
   - Non-string `body` in payload methods (POST, PUT, PATCH, DELETE) is checked via `isJSONSerializable()`. 
   - `Content-Type: application/json` and stringification are applied automatically. Form-encoded requests are transformed via `URLSearchParams`.
   - Streams inject `duplex: 'half'` for compatibility.
6. **AbortSignal & Timeout**: Applies polyfilled `createTimeoutSignal(ms)` merged with user-provided `AbortSignal`.
7. **Execution**: The native `fetch()` is called. Error throws proceed to the Retry/Error flow.
8. **Response Parsing**:
   - Analyzes HTTP `content-type` using `detectResponseType()`.
   - Parses stream to `context.response._data` (via `.json()`, `.text()`, etc.).
9. **`onResponse` Hook**: Dispatched after successful fetch and data hydration.
10. **Error Checking**: Checks if `status >= 400`. If so, triggers `onResponseError` and proceeds to the Error Flow. Otherwise, returns `context.response` (for `.raw()`) or `context.response._data` (for `$fetch()`).

## Retry Mechanism & Error Handling

If a network exception occurs or a `status >= 400` happens (without `ignoreResponseError`), `onError()` takes over:

1. Checks if the error was a user-invoked `AbortError`. If so, aborts immediately without retrying.
2. If retries are configured (Default: 1 for GET, 0 for POST/PUT/DELETE):
   - Validates if the HTTP Status Code is marked for retry (408, 409, 425, 429, 500, 502, 503, 504).
   - If eligible, awaits `retryDelay` and recursively restarts `$factory()` with decreased `retry` count.
3. If retries run out or status is non-retriable, formatting is deferred to `createFetchError(ctx)` from `error.js`.

### `FetchError` Class (`error.js`)

Extends `Error` and attaches request context properties.

**Instance Shape:**
- `message`: Contextual message (preferring backend JSON bodies, fallback to HTTP Status text).
- `status`: HTTP Status code.
- `statusText`: HTTP Status textual description.
- `url`: Executed URL.
- `data`: Extracted response payload (if any).
- `cause`: Underlying native Error.
- `request`, `options`, `response`: Provided as lazy getters directly referencing the `ctx` object to mirror late-mutated state.

## Utilities (`utils.js`)

- **`isJSONSerializable(value)`**: Safely checks JavaScript primitives, Arrays, and plain Objects while strictly forbidding `FormData`, `Blob`, `Buffer`, and Streams.
- **`withQuery(url, queryParams)`**: Robustly composes `URLSearchParams` allowing duplicate keys (via Arrays) and rejecting `undefined` values.
- **`withBase(url, base)`**: Safe path joining avoiding double slashes. 
- **`detectResponseType(contentType)`**: Predicts the best `Response.*()` parser (JSON, text, or stream) based on MIME pattern.
