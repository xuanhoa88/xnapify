# Shared Fetch — Technical Specification

## Overview

The `shared/fetch/` library provides an isomorphic HTTP data fetching wrapper built around the standard Fetch API. It implements an extension-like lifecycle architecture to intercept, transform, and handle requests and responses universally across the server and client.

## Architecture

```
shared/fetch/
├── index.js      # Public API exports
├── factory.js    # Core `$fetch` factory & request pipeline
├── stream.js     # SSE stream parsing & auto-reconnection
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

## SSE Streaming (`stream.js`)

The streaming layer adds native Server-Sent Events support on top of the existing fetch pipeline. Zero external dependencies — all parsing is self-contained.

### Data Flow

```
ReadableStream<Uint8Array>
  → TextDecoderStream (bytes → UTF-8 strings)
    → TextLineStream (chunks → individual lines, inlined ~20 lines)
      → SSE Field Parser (lines → field/value pairs)
        → AsyncGenerator<SSEMessage> (accumulated events on empty-line delimiter)
```

### SSEMessage Shape

```javascript
{
  event: string,    // Event type (e.g. "message", "error")
  data: string,     // Event payload (multi-line data fields joined by \n)
  id: number|string, // Last event ID (numeric if parseable, string otherwise)
  retry: number     // Reconnection interval hint in ms
}
```

### Components

#### `TextLineStream` (internal class)

Inlined `TransformStream` that splits text chunks on `\n`, `\r\n`, or `\r` boundaries. Equivalent to Deno's `@std/streams/text-line-stream`. Buffers partial lines across chunks and flushes any trailing content on stream close.

#### `parseField(line)` (internal function)

Parses a single SSE field line (`field: value`) into a `[field, value]` tuple. Returns `undefined` for comment lines (starting with `:`) and lines without a `:` separator.

#### `parseSSEStream(body, signal?)`

Core AsyncGenerator. Pipes a `ReadableStream<Uint8Array>` through `TextDecoderStream` → `TextLineStream`, then iterates lines to accumulate SSE events. Yields an `SSEMessage` each time an empty line is encountered (per SSE spec). Respects `AbortSignal` for cancellation and releases the reader lock in a `finally` block.

#### `createSSEStream(fetchFn, request, options?)`

Auto-reconnecting wrapper around `parseSSEStream`. Tracks protocol-level `id` and `retry` fields across events. On mid-stream network error:

1. Checks if `AbortSignal` was aborted → stops immediately
2. Checks if `maxRetries` (default: 3) is exhausted → throws the error
3. Waits `retryInterval` ms (default: 1000, updated by SSE `retry` field)
4. Re-fetches with `Last-Event-ID` header set to the last received `id`
5. Resumes yielding events from the new stream

Connection failures on initial fetch propagate immediately on the first attempt, and retry on subsequent attempts.

#### `$fetch.stream(request, options?)` (on factory)

Convenience method on the `$fetch` instance. Delegates to `createSSEStream` using the internal `$factory` function, ensuring the full pipeline (hooks, timeout, baseUrl, headers) is applied. Forces `responseType: 'stream'` and sets `Accept: text/event-stream` by default (overridable). Separates `maxRetries` and `retryInterval` from fetch options to avoid polluting the native call.

Available on child instances created via `$fetch.create()` since `create()` calls `createFetch()` internally.

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
