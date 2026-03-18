# FS Engine

Streaming file operations with multiple provider support (local, memory, self-host), Express upload middleware, and worker integration for batch operations.

## Quick Start

```javascript
const fs = app.get('fs');

await fs.upload({ fileName: 'photo.jpg', buffer, mimeType: 'image/jpeg' });
const result = await fs.download('photo.jpg');
result.data.stream.pipe(res);
```

## API

### Operations

| Method | Description |
|---|---|
| `upload({ fileName, buffer, mimeType })` | Upload a file |
| `download(fileName)` | Download file (returns stream) |
| `remove(fileName)` | Delete a file |
| `copy({ source, target })` | Copy a file |
| `rename({ oldName, newName })` | Rename/move a file |
| `info(fileName)` | Get file metadata |
| `preview(fileName)` | Get file preview |

### Express Middleware

```javascript
const upload = fs.useUploadMiddleware({ fieldName: 'avatar', maxFiles: 1 });
router.post('/avatar', upload, (req, res) => {
  const result = req[fs.MIDDLEWARES.UPLOAD];
});
```

### Worker Control

```javascript
await fs.upload(files, { useWorker: true });  // Force worker
await fs.upload(files, { useWorker: false }); // Force direct
```

### Provider Management

```javascript
fs.getProviderNames();   // ['local', 'memory', 'selfhost']
fs.hasProvider('local');
fs.getProvider('local');
fs.getAllStats();
await fs.cleanup();
```

## Providers

| Provider | Description |
|---|---|
| `local` | Local filesystem storage |
| `memory` | In-memory (dev/testing) |
| `selfhost` | Self-hosted file server |

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
