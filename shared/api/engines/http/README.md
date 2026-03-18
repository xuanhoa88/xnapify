# HTTP Engine

Standardized Express request/response utilities with error sanitization, pagination, and streaming helpers.

## Quick Start

```javascript
import { sendSuccess, sendError, sendPaginated, getPagination } from '@shared/api/engines/http';

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

| Function | Status | Description |
|---|---|---|
| `sendSuccess(res, data, status?, message?, meta?)` | 200 | Standard success |
| `sendCreated(res, data, message?)` | 201 | Resource created |
| `sendAccepted(res, data?, message?)` | 202 | Request accepted |
| `sendNoContent(res)` | 204 | No content |

### Error

| Function | Status | Description |
|---|---|---|
| `sendBadRequest(res, message?, errors?)` | 400 | Bad request |
| `sendUnauthorized(res, message?)` | 401 | Auth required |
| `sendForbidden(res, message?)` | 403 | Access forbidden |
| `sendNotFound(res, message?)` | 404 | Not found |
| `sendMethodNotAllowed(res, allowed?, message?)` | 405 | Method not allowed |
| `sendConflict(res, message?, errors?)` | 409 | Resource conflict |
| `sendValidationError(res, errors, message?)` | 422 | Validation failed |
| `sendRateLimit(res, message?, meta?)` | 429 | Rate limited |
| `sendServerError(res, message?, error?)` | 500 | Server error |
| `sendServiceUnavailable(res, message?, meta?)` | 503 | Service unavailable |

### Specialized

| Function | Description |
|---|---|
| `sendPaginated(res, items, pagination)` | Paginated list with metadata |
| `sendFile(res, filePath, fileName?)` | File download |
| `sendRedirect(res, url, permanent?)` | HTTP redirect (302/301) |
| `sendStream(res, stream, contentType?, headers?)` | Stream response |

## Request Helpers

| Function | Description |
|---|---|
| `getPagination(req, defaults?)` | Extract `page`, `limit`, `offset` from query |
| `getClientIP(req)` | Proxy-aware IP address |
| `getUserAgent(req)` | User agent string |
| `isAjax(req)` | AJAX request check |
| `isJson(req)` | JSON content-type check |
| `getProtocol(req)` | http/https protocol |
| `getBaseUrl(req)` | Absolute base URL |
| `getOrigin(req)` | CORS origin header |
| `getAuthorization(req, scheme?)` | Bearer token extraction |

## Error Sanitization

All error responses are automatically sanitized:
- **Safe keys**: `message`, `field`, `code`, `type`, `reason`
- **Blocked keys**: `stack`, `trace`, `sql`, `query`, `path`, `password`, `token`, `secret`
- Native `Error` instances are hidden behind "Internal server error"
- Each error gets a unique `errorId` (UUID) for log correlation

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
