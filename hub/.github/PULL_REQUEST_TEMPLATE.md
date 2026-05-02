## Extension Submission

<!-- Check the type of change this PR introduces -->

- [ ] 📦 **Publish** — Adding a new extension to the registry
- [ ] 🔄 **Update** — Updating an existing extension (version bump)
- [ ] 🗑️ **Delete** — Removing an extension from the registry

---

### Extension Name

`@xnapify-extension/your-extension-name`

### Checklist

<!-- Complete the checklist for your submission type -->

#### For Publish / Update

- [ ] My extension follows the [xnapify extension architecture](https://github.com/xuanhoa88/xnapify)
- [ ] The metadata JSON file passes schema validation
- [ ] The `key` field matches the `manifest.id` (from my extension's `package.json`)
- [ ] The `downloadUrl` points to a publicly accessible `.zip` archive
- [ ] The `checksum` is a real SHA-256 hash (not all zeros)
- [ ] I have tested installing my extension from the download URL

#### For Delete

- [ ] I am the original author of this extension
- [ ] I understand that existing installations will no longer see this extension in the Hub
- [ ] I have documented the reason for removal below

### Description

<!-- Describe your extension or explain the changes -->

### Reason for Removal (delete only)

<!-- If deleting, explain why the extension is being removed -->
