# HTTP Engine

Standardized Express request/response utilities with error sanitization, pagination, and streaming helpers.

## Quick Start

```javascript
import {
  sendSuccess,
  sendError,
  sendPaginated,
  getPagination,
} from '@shared/api/engines/http';

// Success response
sendSuccess(res, { user });

// Error response (auto-sanitized)
sendError(res, 'Validation failed', 422, errors);

// Paginated response
const { page, limit, offset } = getPagination(req);
sendPaginated(res, items, { page, limit, total });
```

## Response Helpers

### Success

| Function                                           | Status | Description      |
| -------------------------------------------------- | ------ | ---------------- |
| `sendSuccess(res, data, status?, message?, meta?)` | 200    | Standard success |
| `sendCreated(res, data, message?)`                 | 201    | Resource created |
| `sendAccepted(res, data?, message?)`               | 202    | Request accepted |
| `sendNoContent(res)`                               | 204    | No content       |

### Error

| Function                                        | Status | Description         |
| ----------------------------------------------- | ------ | ------------------- |
| `sendBadRequest(res, message?, errors?)`        | 400    | Bad request         |
| `sendUnauthorized(res, message?)`               | 401    | Auth required       |
| `sendForbidden(res, message?)`                  | 403    | Access forbidden    |
| `sendNotFound(res, message?)`                   | 404    | Not found           |
| `sendMethodNotAllowed(res, allowed?, message?)` | 405    | Method not allowed  |
| `sendConflict(res, message?, errors?)`          | 409    | Resource conflict   |
| `sendValidationError(res, errors, message?)`    | 422    | Validation failed   |
| `sendRateLimit(res, message?, meta?)`           | 429    | Rate limited        |
| `sendServerError(res, message?, error?)`        | 500    | Server error        |
| `sendServiceUnavailable(res, message?, meta?)`  | 503    | Service unavailable |

### Specialized

| Function                                          | Description                  |
| ------------------------------------------------- | ---------------------------- |
| `sendPaginated(res, items, pagination)`           | Paginated list with metadata |
| `sendFile(res, filePath, fileName?)`              | File download                |
| `sendRedirect(res, url, permanent?)`              | HTTP redirect (302/301)      |
| `sendStream(res, stream, contentType?, headers?)` | Stream response              |

## Request Helpers

| Function                         | Description                                  |
| -------------------------------- | -------------------------------------------- |
| `getPagination(req, defaults?)`  | Extract `page`, `limit`, `offset` from query |
| `getClientIP(req)`               | Proxy-aware IP address                       |
| `getUserAgent(req)`              | User agent string                            |
| `isAjax(req)`                    | AJAX request check                           |
| `isJson(req)`                    | JSON content-type check                      |
| `getProtocol(req)`               | http/https protocol                          |
| `getBaseUrl(req)`                | Absolute base URL                            |
| `getOrigin(req)`                 | CORS origin header                           |
| `getAuthorization(req, scheme?)` | Bearer token extraction                      |

## Error Sanitization

All error responses are automatically sanitized:

- **Safe keys**: `message`, `field`, `code`, `type`, `reason`
- **Blocked keys**: `stack`, `trace`, `sql`, `query`, `path`, `password`, `token`, `secret`
- Native `Error` instances are hidden behind "Internal server error"
- Each error gets a unique `errorId` (UUID) for log correlation

---

# HTTP Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the HTTP Engine at `shared/api/engines/http`.

---

## Objective

Provide standardized Express utilities for request parsing, response formatting, and error sanitization.

## 1. Architecture

```
shared/api/engines/http/
├── index.js        # Default singleton export + re-exports
├── factory.js      # EngineManager + createFactory()
├── constants.js    # HTTP_STATUS enum
├── response.js     # Response helpers + error sanitization
├── request.js      # Request utility functions
└── errors.js       # Error class definitions and utilities
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
