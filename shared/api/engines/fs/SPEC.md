# FS Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the FS Engine at `shared/api/engines/fs`.

---

## Objective

Provide a streaming file operations layer with multiple storage providers, Express upload middleware, and background worker support.

## 1. Architecture

```
shared/api/engines/fs/
├── index.js            # Default singleton
├── factory.js          # FileManager class + createFactory()
├── middlewares.js       # Multer-based Express upload middleware
├── operations/         # File operation implementations
├── providers/          # Storage adapters (local, memory, selfhost)
├── services/           # Service functions
├── utils/              # Utility functions
├── workers/            # Background worker handlers
├── fs.test.js          # Jest tests
└── fs.extract.test.js  # Extraction tests
```

## 2. FileManager (`factory.js`)

- Provider registry pattern (same as email engine).
- Operations: `upload`, `download`, `remove`, `copy`, `rename`, `info`, `preview`, `sync`.
- Auto-offloads batch operations to workers.
- `useUploadMiddleware(options)` — returns Multer-based Express middleware.

## 3. Middleware (`middlewares.js`)

- Wraps Multer for multipart file uploads.
- Results attached to `req[fs.MIDDLEWARES.UPLOAD]`.
- Configurable: `fieldName`, `maxFiles`, `maxFileSize`, `allowedMimeTypes`.

## 4. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('fs')`.

---

*Note: This spec reflects the CURRENT implementation of the fs engine.*
