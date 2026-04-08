# Core Module AI Instructions

This folder (`src/apps/search/`) is a **Core Module** that owns the full-text search engine.

**INHERITANCE NOTICE**: All global AI rules from `.agent/rules.md` and the architecture from `AGENT.md` strictly apply here.

## Module Ownership

This module provides the search engine for the entire application. Unlike other modules that only consume the search service, this module:

1. **Owns the `SearchDocument` model** — Sequelize model in `api/models/SearchDocument.js`
2. **Owns the database migration** — `api/database/migrations/` creates the `search_documents` table
3. **Owns the search factory** — `api/factory.js` with `createFactory()`, `registerAdapter()`, `withNamespace()`
4. **Owns the database adapter** — `api/adapters/database.js` with native FTS (SQLite FTS5, PostgreSQL tsvector, MySQL FULLTEXT)
5. **Registers the DI binding** — `container.bind('search', ...)` during `providers()` lifecycle
6. **Exposes adapter registration** — `container.bind('search:registerAdapter', ...)` for extensions

## Local Module Constraints

Unlike Extensions, Core Modules are fully woven into the backend architecture.
1. **Direct Imports Allowed**: You may import functions from other core modules if necessary, though using `@shared/` dependencies is still preferred.
2. **Schema Control**: You are allowed to create and export original Sequelize models in `api/models/`. You do not need to use Extension Hooks to alter the DB.
3. **Native Routing**: You must expose your API endpoints directly via `api/index.js` or `api/routes.js` using standard Express Routers. Do not use Slots or Hooks.
4. **Initial Props**: For frontend views (`views/`), utilize the `getInitialProps` lifecycle inside `_route.js` to handle data fetching before rendering.

Always prioritize these local boundary constraints when refactoring or building new features within this module.
