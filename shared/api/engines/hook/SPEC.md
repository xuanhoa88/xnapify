# Hook Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Hook Engine at `shared/api/engines/hook`.

---

## Objective

Provide a channel-based async event system for decoupled inter-module communication with priority ordering and mutable argument passing.

## 1. Architecture

```
shared/api/engines/hook/
├── index.js             # Default singleton, re-exports
├── factory.js           # HookFactory class + createFactory()
├── channel.js           # HookChannel class
├── hook.test.js         # Tests
└── hook.binding.test.js # Context binding tests
```

## 2. HookChannel (`channel.js`)

- Internal state stored via Symbols: `__rsk.hookName__`, `__rsk.hookHandlers__`.
- `handlers` is `Map<event, Array<{ handler, priority }>>`.
- `on(event, handler, priority=10)` — pushes and sorts by priority (ascending).
- `emit(event, ...args)` — iterates handlers sequentially with `await`.
- `off(event?, handler?)` — removes all, per-event, or specific handler (by reference equality).
- `withContext(context)` — returns wrapper that calls `handler.call(context, ...args)`. Uses `WeakMap` to track wrapped functions.

## 3. HookFactory (`factory.js`)

- Internal: `Map<name, HookChannel>` stored via Symbol.
- `channel(name)` — lazy-creates `HookChannel` on first access.
- `has(name)`, `remove(name)`, `getChannelNames()`, `cleanup()`.
- `createFactory()` returns a callable function (`factory(name)` === `factory.channel(name)`) with all methods attached.
- `withContext(context)` — returns a new callable factory that wraps every channel with `channel.withContext(context)`.

## 4. Default Singleton

`index.js` exports `createFactory()`. Registered on DI as `app.get('hook')`.

## 5. Usage by Auth Middleware

Auth middlewares use hook channels for extensibility:
- `auth.permissions` — resolve user permissions from DB
- `auth.roles`, `auth.groups` — resolve roles/groups
- `auth.ownership` — resolve resource ownership
- `auth.strategy.{type}` — pluggable auth strategies

---

*Note: This spec reflects the CURRENT implementation of the hook engine.*
