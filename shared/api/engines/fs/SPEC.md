# FS Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the FS Engine at `shared/api/engines/fs`.
> This engine provides streaming file operations with multiple storage providers, Express upload middleware, and background worker support.

---

## Objective

Provide a unified file operations layer with pluggable storage providers (local, memory, selfhost), Multer-based Express upload middleware, worker pool integration for batch operations, and comprehensive file utilities.

## 1. Architecture

```
shared/api/engines/fs/
├── index.js              # Default singleton + createFactory export
├── factory.js            # FilesystemManager class + createFactory()
├── middlewares.js         # Multer-based Express upload middleware
├── operations/           # Low-level operation implementations (10 files)
├── services/             # Worker-enabled wrappers for operations (10 files)
├── providers/            # Storage backend adapters
│   ├── local.js          # Local filesystem (disk)
│   ├── memory.js         # In-memory (testing/dev)
│   └── selfhost.js       # Self-hosted HTTP file server
├── utils/
│   ├── constants.js      # SIZE_LIMITS, ERROR_CODES, env config
│   ├── errors.js         # FilesystemError + FilesystemWorkerError
│   ├── file-types.js     # MIME type mappings
│   ├── file-utils.js     # File utility functions
│   ├── upload-presets.js  # Upload configuration presets
│   ├── zip-utils.js      # ZIP creation/extraction utilities
│   └── index.js          # Re-exports all utils
├── workers/
│   ├── index.js          # Worker pool with high-level operation methods
│   ├── upload.worker.js  # Upload worker handler
│   ├── download.worker.js
│   ├── delete.worker.js
│   ├── copy.worker.js
│   ├── rename.worker.js
│   ├── sync.worker.js
│   ├── info.worker.js
│   └── zip.worker.js     # ZIP create/extract worker
├── fs.test.js            # Main Jest tests
└── fs.extract.test.js    # Extraction tests
```

### Dependency Graph

```
index.js
└── factory.js
    ├── middlewares.js (multer, uuid)
    ├── services/* → operations/* + workers/index.js
    ├── providers/local.js (fs, stream/promises)
    ├── providers/memory.js (stream)
    ├── providers/selfhost.js (node-fetch)
    └── utils/* (crypto, os, path)

workers/index.js
└── @shared/api/engines/worker (createWorkerPool)
```

## 2. FilesystemManager Class (`factory.js`)

### Constructor

```javascript
new FilesystemManager({ provider, local, memory, selfhost })
```

- `provider` — default provider name (default: `'local'`).
- Immediately initializes 3 default providers:
  - `'local'` → `LocalFilesystemProvider(config.local)`
  - `'memory'` → `MemoryFilesystemProvider(config.memory)`
  - `'selfhost'` → `SelfHostFilesystemProvider(config.selfhost)` — **only if** `config.selfhost.baseUrl` is set

### Provider Management

| Method | Returns | Description |
|---|---|---|
| `addProvider(name, provider)` | `boolean` | Register custom provider. **Refuses overrides** (logs warning). |
| `getProvider(name?)` | provider | Get by name or default. Throws `FilesystemError` (`PROVIDER_NOT_FOUND`, 404). |
| `getProviderNames()` | `string[]` | List registered providers. |
| `hasProvider(name)` | `boolean` | Check existence. |
| `getAllStats()` | `object` | Stats from all providers (calls `provider.getStats()` if available). |
| `cleanup()` | `Promise<void>` | Calls `provider.close()` on all providers, then clears the map. |

### Operations (delegated to services)

All operations accept an optional `options` param. The service layer decides worker vs direct execution.

| Method | Signature | Description |
|---|---|---|
| `upload(files, options?)` | single or array | Upload file(s) |
| `download(fileNames, options?)` | single or array | Download file (returns stream) |
| `remove(fileNames, options?)` | single or array | Delete file(s) |
| `copy(ops, options?)` | `{ source, target }` | Copy file(s) |
| `rename(ops, options?)` | `{ oldName, newName }` | Rename/move file(s) |
| `info(fileName, options?)` | string | Get file metadata |
| `preview(fileName, options?)` | string | Get file preview |
| `sync(ops, options?)` | operations array | Sync operations |
| `extract(zipSource, extractPath, options?)` | strings | Extract ZIP archive |

### Low-Level Provider Methods

| Method | Signature | Description |
|---|---|---|
| `exists(fileName, options?)` | string | Check if file exists |
| `getMetadata(fileName, options?)` | string | Get file metadata |
| `list(directory?, options?)` | string | List directory contents |

### Middleware

```javascript
useUploadMiddleware(options?) → Express middleware
```

Creates Multer middleware using the specified provider (or default). See §4 for details.

## 3. Service Layer (`services/`)

Services wrap operations with automatic worker offloading.

### Worker Auto-Decision (upload example)

```javascript
const AUTO_WORKER_THRESHOLDS = {
  fileCount: 3,           // Use worker for 3+ files
  fileSize: 5 * 1024 * 1024,  // Use worker for 5MB+ total
  maxWorkerFileSize: 50 * 1024 * 1024, // Bypass worker for 50MB+ (avoid IPC overhead)
};
```

- `options.useWorker = true` → force worker
- `options.useWorker = false` → force direct
- `options.useWorker = undefined` → auto-decide based on thresholds

## 4. Middleware (`middlewares.js`)

### `MIDDLEWARES` Constants

```javascript
{ UPLOAD: Symbol('__xnapify.fsUpload__') }
```

Results attached to `req[MIDDLEWARES.UPLOAD]`.

### `createUploadMiddleware(provider, options) → Express middleware`

| Option | Default | Description |
|---|---|---|
| `fieldName` | `'file'` | Form field name |
| `maxFiles` | `1` | Max files per request |
| `maxFileSize` | `10MB` | Max file size in bytes |
| `allowedMimeTypes` | `null` (all) | Array of allowed MIME types |
| `useWorker` | `false` | Enable worker post-processing |

**Behavior:**
- Creates custom Multer storage engine that streams files directly to the provider via `provider.store()`.
- Generates unique filenames: `<timestamp>_<uuid-8-chars>.<ext>`.
- Auto-selects `upload.single()` or `upload.array()` based on `maxFiles`.
- Stores result in `req[MIDDLEWARES.UPLOAD]`:
  - Success single: `{ success: true, data: { fileName, originalName, mimeType, size, path, provider } }`
  - Success multi: `{ success: true, data: { successful: [...] } }`
  - Failure: `{ success: false, error: string }`
- Errors don't call `next(err)` — they set the error in the result and call `next()`.

## 5. Providers

All providers implement: `store`, `retrieve`, `delete`, `exists`, `getMetadata`, `list`, `copy`, `move`, `getStats`.

### Local Provider (`providers/local.js`)

| Config | Default | Description |
|---|---|---|
| `basePath` | `~/.xnapify/uploads` | Base directory |
| `createDirectories` | `true` | Auto-create dirs |
| `maxFileSize` | `10MB` | Max file size |
| `allowedExtensions` | `null` (all) | Extension whitelist |

**Key behaviors:**
- **Dual mode `store()`**: Detects streams vs buffers. Streams pipe directly to disk (zero buffering) via `pipeline()`. Buffers handle IPC deserialization (reconstructs `{ type: 'Buffer', data: [...] }` format).
- **Streaming download**: Returns `createReadStream()`.
- **Recursive listing**: `list()` supports `{ recursive: true, filesOnly, directoriesOnly }`.
- Extension validation on `store()`.

### Memory Provider (`providers/memory.js`)

| Config | Default | Description |
|---|---|---|
| `maxFileSize` | `10MB` | Max file size |
| `maxFiles` | `1000` | Max entries |
| `allowedExtensions` | `null` (all) | Extension whitelist |

**Key behaviors:**
- Stores files in `Map<fileName, { buffer, metadata }>`.
- Streams collected into buffer (inherent limitation).
- `clear()` method for testing.
- No real directory support — `list()` filters by filename prefix.

### Self-Host Provider (`providers/selfhost.js`)

| Config | Required | Default | Description |
|---|---|---|---|
| `baseUrl` | ✅ | — | Server URL |
| `apiKey` | — | `null` | Bearer token for `Authorization` header |
| `timeout` | — | `30s` | Request timeout (AbortController) |
| `maxFileSize` | — | `10MB` | Max file size |
| `routes` | — | defaults | Configurable REST route definitions |

**Key behaviors:**
- All HTTP requests via `node-fetch` with `AbortController` timeout.
- Fully configurable routes via functions: `({ fileName }) => ({ path, method, query?, body? })`.
- Default routes: `POST /files`, `GET /files`, `DELETE /files`, `HEAD /files` (with query params).
- Streams collected to buffer for HTTP `Content-Length`.
- Converts web ReadableStream to Node.js Readable for downloads.

## 6. Worker Pool (`workers/index.js`)

Uses `createWorkerPool('📁 Filesystem', { ErrorHandler: FilesystemWorkerError })`.

Workers are pre-compiled as standalone CJS files and discovered from the `workers/` directory at runtime via `fs.readdirSync`.

### High-Level Worker Methods

| Method | Worker | Message Type | Supports `forceFork` |
|---|---|---|---|
| `processUpload(filesData, options)` | `upload` | `UPLOAD_SINGLE/BATCH` | ✅ |
| `processDownload(fileNames, options)` | `download` | `DOWNLOAD_SINGLE/BATCH` | — |
| `processDelete(fileNames, options)` | `delete` | `DELETE_SINGLE/BATCH` | ✅ |
| `processRename(operations, options)` | `rename` | `RENAME_SINGLE/BATCH` | ✅ |
| `processCopy(operations, options)` | `copy` | `COPY_SINGLE/BATCH` | ✅ |
| `processSync(operations, options)` | `sync` | `SYNC_SINGLE/BATCH` | — |
| `processInfo(fileName, options)` | `info` | `GET_FILE_INFO` | — |
| `processPreview(fileName, options)` | `info` | `PREVIEW_FILE` | — |
| `createZipFile(fileInfos, outputPath, options)` | `zip` | `CREATE_ZIP` | — |
| `extractZip(zipSource, extractPath, options)` | `zip` | `EXTRACT_ZIP` | — |

All methods auto-detect `SINGLE` vs `BATCH` based on array length.

### Unregister Methods

Each worker type has dedicated `unregisterX()` methods (e.g., `unregisterUpload()`, `unregisterZip()`).

## 7. Error Classes (`utils/errors.js`)

| Class | Extends | Code Default | Status | Extra Props |
|---|---|---|---|---|
| `FilesystemError` | `Error` | `'PROVIDER_ERROR'` | `500` | `timestamp` |
| `FilesystemWorkerError` | `WorkerError` | `'WORKER_ERROR'` | `500` | inherits from WorkerError |

### `createOperationResult(success, data?, message?, error?)`

Standardized result object: `{ success, data, message, timestamp, error? }`. Includes stack trace in development mode.

## 8. Constants (`utils/constants.js`)

### Environment Variables

| Env Var | Default | Description |
|---|---|---|
| `XNAPIFY_UPLOAD_FILE_SIZE` | `50MB` | Max upload file size |
| `XNAPIFY_UPLOAD_FILE_LENGTH` | `255` | Max filename length |
| `XNAPIFY_UPLOAD_DIR` | `~/.xnapify/uploads` | Upload directory |
| `XNAPIFY_UPLOAD_FILE_EXT` | `null` (all) | Comma-separated allowed extensions |

### `ERROR_CODES`

```javascript
FILE_NOT_FOUND, INVALID_FILE_TYPE, FILE_TOO_LARGE, UPLOAD_FAILED,
DOWNLOAD_FAILED, DELETE_FAILED, COPY_FAILED, MOVE_FAILED,
INVALID_INPUT, PROVIDER_ERROR, PERMISSION_DENIED, STORAGE_FULL
```

### `SIZE_LIMITS`

```javascript
{ KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }
```

## 9. Default Singleton

**File:** `index.js`

```javascript
const fs = createFactory();
export default fs;
```

`createFactory()` also attaches `MIDDLEWARES` constant to the instance. The singleton is registered on the DI container as `container.resolve('fs')`.

## 10. Integration Points

- **Express routes**: Use `fs.useUploadMiddleware()` for file upload endpoints.
- **Worker engine**: Services auto-offload to the filesystem worker pool for batch operations.
- **Schedule engine**: Schedule periodic file cleanup with `fs.list()` + `fs.remove()`.
- **Queue engine**: Queue file processing jobs (image resize, thumbnail generation).
- **Modules**: Access via `container.resolve('fs')` in module `init()`.

---

*Note: This spec reflects the CURRENT implementation of the fs engine.*
