# HTTP Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the HTTP Engine at `shared/api/engines/http`.

---

## Objective

Provide standardized Express utilities for request parsing, response formatting, and error sanitization.

## 1. Architecture

```
shared/api/engines/http/
├── index.js        # Re-exports all modules
├── constants.js    # HTTP_STATUS enum
├── response.js     # Response helpers + error sanitization
├── request.js      # Request utility functions
└── errors/         # Error class definitions
```

## 2. Response Format

All responses follow a standard structure:

```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {},
  "message": "...",
  "meta": {}
}
```

Error responses add `errors` and `errorId` fields.

## 3. Error Sanitization (`sanitizeError`)

- `SAFE_ERROR_KEYS`: `message`, `field`, `code`, `type`, `reason`.
- `BLOCKED_KEYS`: `stack`, `trace`, `sql`, `query`, `path`, `password`, `token`, `secret`.
- Native `Error` instances → `{ message: 'Internal server error' }` (details hidden).
- Dictionary-shaped validation objects (all string values) pass through unfiltered.
- Each error gets a `randomUUID()` for log correlation.
- In `__DEV__`, errors are logged to console. In production, only 5xx errors are logged.

## 4. HTTP Status Constants

`HTTP_STATUS`: `OK` (200), `CREATED` (201), `ACCEPTED` (202), `NO_CONTENT` (204), `FOUND` (302), `NOT_MODIFIED` (304), `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `CONFLICT` (409), `UNPROCESSABLE_ENTITY` (422), `TOO_MANY_REQUESTS` (429), `INTERNAL_SERVER_ERROR` (500), `SERVICE_UNAVAILABLE` (503).

## 5. Request Utilities (`request.js`)

- `getPagination(req, defaults)` — returns `{ page, limit, offset }` clamped to `maxLimit`.
- `getClientIP(req)` — reads `X-Forwarded-For` first.
- `getBaseUrl(req)` — constructs `protocol://host`.

---

*Note: This spec reflects the CURRENT implementation of the http engine.*
