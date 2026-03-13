# Files Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the file and storage management logic inside `src/apps/files`.
> This module provides a cloud-drive experience for users and administrators.

---

## Objective
Provide a centralized file management system capable of handling uploads, downloads, folder hierarchies, and collaborative sharing.

## 1. Database Modifications (`api/models`)
- **Model:** `File`
  - **Properties:** `id` (UUID), `name`, `parent_id` (Recursive self-relation for folders), `type` (file/folder), `size`, `mime_type`, `storage_path`, `is_trash` (Soft delete flag).
- **Model:** `FileStar`
  - **Properties:** Links `User` to `File` for personal bookmarks.
- **Model:** `FileShare`
  - **Properties:** Links `File` to `User` or `Group` with specific access levels.

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/files`
  - **Logic:** Returns files in the current folder (or root) based on `parent_id`.
- **Method & Path:** `POST /api/files/upload`
  - **Security:** Requires `files:write` permission.
  - **Logic:** Buffers upload to configured storage provider (Local/S3) and creates DB record.
- **Method & Path:** `GET /api/files/[id]/download`
  - **Logic:** Streams file content securely to the client.
- **Method & Path:** `PATCH /api/files/[id]/rename`
  - **Logic:** Updates the file or folder display name.
- **Method & Path:** `POST /api/files/[id]/move`
  - **Logic:** Changes `parent_id` to relocate files/folders.
- **Method & Path:** `POST /api/files/[id]/star`
  - **Logic:** Toggles bookmark status for the current user.
- **Trash Management:**
  - `DELETE /api/files/[id]`: Moves file to trash (`is_trash: true`).
  - `POST /api/files/[id]/restore`: Recover from trash.
  - `DELETE /api/files/trash/empty`: Permanently removes all items in trash.

## 3. Frontend SSR Rendering (`views/`)
- **Drive View:** `/admin/files`
  - **Component:** `Drive.js` or `FileManager.js`.
  - **Logic:** Interactive UI with breadcrumb navigation, drag-and-drop uploads, and context menus for file actions.
- **Special Folders:**
  - `/admin/files/starred`: Filtered view of `FileStar` items.
  - `/admin/files/trash`: View of items where `is_trash: true`.
- **State Management:** Uses dynamic Redux slice to track current directory, selection, and upload progress.

## 4. Localization (`translations/`)
- **Keys:** `files.ui.upload_limit`, `files.actions.delete_confirm`, `files.empty_state.no_files`.
- **Rule:** Storage size units (KB, MB, GB) should be formatted using the shared i18n utility.

---
*Note: This spec reflects the CURRENT implementation of the file storage system.*
