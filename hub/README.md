# xnapify Extension Hub

> The official public registry for [xnapify](https://github.com/xuanhoa88/xnapify) extensions.

This repository is the central directory of community-contributed extensions.  
It does **not** store extension code — only lightweight JSON metadata files that point to each extension's downloadable archive.

---

## 🔍 How It Works

```
extensions/
  └── @xnapify-extension/
      ├── google-analytics.json    ← metadata pointing to author's GitHub Release
      ├── payment-gateway.json
      └── ...

registry.json   ← auto-generated on merge (consumed by xnapify instances)
```

Every xnapify instance fetches `registry.json` to display the public extension catalog.  
When a user clicks **Install**, the app downloads the `.zip` directly from the extension author's URL.

---

## 📦 Publishing an Extension

### Prerequisites

1. Your extension is built using the [xnapify extension architecture](https://github.com/xuanhoa88/xnapify).
2. Your extension `.zip` is uploaded to a publicly accessible URL (e.g., a GitHub Release).
3. You know your extension's SHA-256 checksum.

### Steps

1. **Fork** this repository.

2. **Create a branch** named after your extension:
   ```bash
   git checkout -b add/my-awesome-extension
   ```

3. **Create a metadata file** in the `extensions/` directory:
   ```bash
   # For scoped extensions (recommended):
   extensions/@xnapify-extension/my-awesome-extension.json

   # For unscoped extensions:
   extensions/my-awesome-extension.json
   ```

4. **Fill in the metadata** (see [Metadata Format](#-metadata-format) below).

5. **Open a Pull Request** against the `main` branch.

6. **Wait for CI** — our GitHub Actions will automatically validate your submission.

7. **Maintainer review** — once approved and merged, your extension appears in the public registry.

### Updating an Existing Extension

To publish a new version, update the `version`, `downloadUrl`, and `checksum` fields in your existing JSON file and submit a new PR.

### Removing an Extension

To remove your extension from the public registry:

1. **Create a branch** named `remove/your-extension-name`.
2. **Delete your metadata JSON file** from `extensions/`.
3. **Open a Pull Request** against the `main` branch.
4. **Explain the reason** for removal in the PR description.
5. **Maintainer review** — removals require explicit maintainer approval.

> **Note:** Removing an extension from the registry does not uninstall it from existing xnapify instances. It only prevents new installations from the Hub.

---

## 📋 Metadata Format

Each extension is described by a single JSON file with the following fields:

```json
{
  "name": "@xnapify-extension/my-extension",
  "key": "@xnapify-extension/my-extension",
  "version": "1.0.0",
  "description": "A longer description of what this extension does. Supports markdown.",
  "short_description": "One-liner for catalog display (max 160 chars)",
  "category": "productivity",
  "tags": ["utility", "admin"],
  "icon": "⚡",
  "author": "your-github-username",
  "repository": "https://github.com/your-username/your-extension-repo",
  "compatibility": ">=1.0.0",
  "type": "plugin",
  "downloadUrl": "https://github.com/your-username/your-repo/releases/download/v1.0.0/my-extension-v1.0.0.zip",
  "checksum": "sha256-hex-string-of-your-extension-directory"
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `name` | Full package name (e.g., `@xnapify-extension/my-ext`) |
| `key` | Unique extension key — must match `manifest.id` in your extension's `package.json` |
| `version` | SemVer version string |
| `author` | Your GitHub username or display name |
| `category` | One of the [allowed categories](#categories) |
| `downloadUrl` | Direct URL to the `.zip` archive |
| `checksum` | SHA-256 hex hash of the extension directory (see below) |

### Optional Fields

| Field | Description |
|-------|-------------|
| `description` | Full description (supports markdown) |
| `short_description` | One-liner for card display (max 160 chars) |
| `tags` | Array of searchable tags |
| `icon` | Emoji or icon URL |
| `repository` | URL to the extension's source code |
| `compatibility` | xnapify version requirement (SemVer range) |
| `type` | `plugin` (default) or `module` |
| `featured` | `true` to feature in the marketplace (maintainer-only) |
| `deprecated` | `true` to flag as deprecated — hidden from new installs |
| `screenshots` | Array of screenshot URLs |

### Categories

| Key | Label |
|-----|-------|
| `authentication` | Authentication |
| `communication` | Communication |
| `analytics` | Analytics |
| `productivity` | Productivity |
| `developer-tools` | Developer Tools |
| `content` | Content |
| `social` | Social |
| `security` | Security |
| `integration` | Integration |
| `other` | Other |

---

## 🔐 Computing the Checksum

The checksum is a SHA-256 hash of your **built** extension directory, computed using [`folder-hash`](https://www.npmjs.com/package/folder-hash).

The following files/directories are **excluded** from the hash:
- `node_modules/`, `.git/`, `__tests__/`, `__mocks__/`
- `package.json`, `package-lock.json`, `.DS_Store`, `npm-debug.log`

You can compute it with:

```bash
npx folder-hash --algo sha256 --encoding hex \
  --exclude-folders "node_modules,.git,__tests__,__mocks__" \
  --exclude-files "package.json,package-lock.json,.DS_Store,npm-debug.log" \
  ./path/to/your/built-extension
```

Or programmatically:

```javascript
const { hashElement } = require('folder-hash');

const result = await hashElement('./my-extension', {
  algo: 'sha256',
  encoding: 'hex',
  folders: { exclude: ['node_modules', '.git', '__tests__', '__mocks__'] },
  files: { exclude: ['package.json', 'package-lock.json', '.DS_Store', 'npm-debug.log'] },
});

console.log(result.hash);
```

---

## 🛡️ Security

- **Checksum verification**: xnapify verifies the SHA-256 checksum after download and before activation.
- **Integrity tracking**: After installation, a fresh checksum is computed and stored. On every activation, the stored checksum is re-verified to detect tampering.
- **PR review**: All submissions go through maintainer review before merging.
- **CI validation**: Automated checks verify schema, URL reachability, and duplicate detection.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
