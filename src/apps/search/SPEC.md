# Search Module AI Specification

> **Instructions for the AI:** 
> Read this document to understand the full-text search indexing logic inside `src/apps/search`.
> This module uses high-performance background workers to index and query system data.

---

## Objective
Provide a unified, ultra-fast search interface across all system entities (users, groups, files, etc.) using FlexSearch and Node.js workers.

## 1. Database Modifications (`api/models`)
*The Search module does not own its own core models. It maintains an ephemeral in-memory index sourced from other modules' data.*

## 2. API Routes & Controllers (`api/`)
- **Method & Path:** `GET /api/search`
  - **Security:** Requires `authenticated` level.
  - **Parameters:**
    - `q`: Search query string (Required).
    - `entityType`: Filter by specific model (e.g., `User`).
    - `namespace`: Filter by application domain (e.g., `files`).
    - `limit` / `offset`: Pagination controls.
  - **Logic:** Dispatches query to the `FlexSearch` search engine and returns ranked results with metadata.

## 3. Background Workers
- **Search indexing** is handled by per-module worker functions (e.g., `groups/api/workers/search.worker.js`, `users/api/workers/search.worker.js`).
- Each module registers search hooks via `registerSearchHooks(container, search)` to keep the index in sync with mutations.
- **Lifecycle:** Index is built on startup via `indexAll*()` functions and kept current via hook listeners for create/update/delete events.

## 4. Frontend SSR Rendering (`views/`)
*The Search module is currently API-focused. The UI is integrated into the global navigation bar via `ExtensionSlot` or shared components. Search results are typically displayed in a global overlay or dedicated search results page managed by the renderer.*

## 5. Localization (`translations/`)
- **Keys:** `search.placeholder`, `search.results.count_stats`, `search.no_results.title`.
- **Note:** Entity types (e.g., "Files", "People") should be translated using the keys defined in their respective modules.

---
*Note: This spec reflects the CURRENT implementation of the FlexSearch-based search engine.*
