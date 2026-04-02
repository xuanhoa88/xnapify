# FS Engine

Streaming file operations with multiple provider support (local, memory, self-host), Express upload middleware, and worker integration for batch operations.

## Quick Start

```javascript
const fs = container.resolve('fs');

// Upload a file
await fs.upload({ fileName: 'photo.jpg', buffer, mimeType: 'image/jpeg' });

// Download (returns stream)
const result = await fs.download('photo.jpg');
result.data.stream.pipe(res);

// Other operations
await fs.remove('photo.jpg');
await fs.copy({ source: 'a.jpg', target: 'b.jpg' });
await fs.rename({ oldName: 'a.jpg', newName: 'b.jpg' });
const meta = await fs.info('photo.jpg');
```

## API

### Operations

| Method | Signature | Description |
|---|---|---|
| `upload(files, options?)` | single or array | Upload file(s) |
| `download(fileNames, options?)` | single or array | Download (returns stream) |
| `remove(fileNames, options?)` | single or array | Delete file(s) |
| `copy(ops, options?)` | `{ source, target }` | Copy file(s) |
| `rename(ops, options?)` | `{ oldName, newName }` | Rename/move |
| `info(fileName, options?)` | string | File metadata |
| `preview(fileName, options?)` | string | File preview |
| `sync(ops, options?)` | array | Sync operations |
| `extract(zipSource, extractPath, options?)` | strings | Extract ZIP |

### Low-Level Methods

| Method | Returns | Description |
|---|---|---|
| `exists(fileName, options?)` | `boolean` | Check if file exists |
| `getMetadata(fileName, options?)` | `object` | Get file metadata |
| `list(directory?, options?)` | `Array` | List directory contents |

### Express Upload Middleware

```javascript
const upload = fs.useUploadMiddleware({
  fieldName: 'avatar',
  maxFiles: 1,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png'],
});

router.post('/avatar', upload, (req, res) => {
  const result = req[fs.MIDDLEWARES.UPLOAD];
  // { success: true, data: { fileName, originalName, mimeType, size, path, provider } }
});
```

- Auto-selects `single()` or `array()` based on `maxFiles`.
- Generates unique filenames: `<timestamp>_<uuid>.<ext>`.
- Errors stored in result (doesn't call `next(err)`).

### Worker Control

Operations auto-decide worker usage based on file count and size:

```javascript
await fs.upload(files);                       // Auto-decide
await fs.upload(files, { useWorker: true });   // Force worker (batch)
await fs.upload(files, { useWorker: false });  // Force direct
```

Thresholds: worker for 3+ files or 5MB+ total, bypass for 50MB+ (IPC overhead).

### Provider Management

```javascript
fs.getProviderNames();              // ['local', 'memory', 'selfhost']
fs.hasProvider('local');             // true
fs.getProvider('local');             // provider instance
fs.addProvider('s3', myS3Provider);  // register custom (no overrides)
fs.getAllStats();                    // stats from all providers
await fs.cleanup();                 // close all providers
```

## Providers

| Provider | Storage | Default Dir | Features |
|---|---|---|---|
| `local` | Disk | `~/.xnapify/uploads` | Stream-to-disk, recursive listing, extension validation |
| `memory` | In-memory Map | — | Max 1000 files, for testing/dev |
| `selfhost` | HTTP REST | — | Configurable routes, API key auth, 30s timeout |

### Provider Interface

All providers implement: `store`, `retrieve`, `delete`, `exists`, `getMetadata`, `list`, `copy`, `move`, `getStats`.

## Environment Variables

| Var | Default | Description |
|---|---|---|
| `XNAPIFY_UPLOAD_FILE_SIZE` | `50MB` | Max upload size |
| `XNAPIFY_UPLOAD_FILE_LENGTH` | `255` | Max filename length |
| `XNAPIFY_UPLOAD_DIR` | `~/.xnapify/uploads` | Upload directory |
| `XNAPIFY_UPLOAD_FILE_EXT` | all | Comma-separated allowed extensions |

## Error Handling

```javascript
import { FilesystemError } from '@shared/api/engines/fs/utils';

// FilesystemError — base (code: 'PROVIDER_ERROR', statusCode: 500)
// FilesystemWorkerError — worker operations (extends Error)
```

## Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/fs';
const testFs = createFactory({ provider: 'memory' });
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
