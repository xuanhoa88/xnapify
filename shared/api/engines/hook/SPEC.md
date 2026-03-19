# Hook Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Hook Engine at `shared/api/engines/hook`.
> This engine provides channel-based async event hooks with priority ordering and mutable argument passing.

---

## Objective

Provide a channel-based async event system for decoupled inter-module communication. Handlers run sequentially with priority ordering and can mutate shared arguments by reference.

## 1. Architecture

```
shared/api/engines/hook/
├── index.js             # Default singleton, re-exports
├── factory.js           # HookFactory class + createFactory()
├── channel.js           # HookChannel class
├── hook.test.js         # Core tests
└── hook.binding.test.js # Context binding tests
```

### Dependency Graph

```
index.js
├── factory.js
│   └── channel.js
└── channel.js
```

No external dependencies. No error classes file — errors are thrown inline.

## 2. HookChannel Class (`channel.js`)

### Private State

Internal state is stored via Symbols to prevent external access:
- `Symbol('__rsk.hookName__')` → channel name string
- `Symbol('__rsk.hookHandlers__')` → `Map<event, Array<{ handler, priority }>>`

### Getters

| Getter | Returns | Description |
|---|---|---|
| `name` | `string` | Channel name |
| `handlers` | `Map` | Raw handlers map |
| `events` | `string[]` | Registered event names (`Array.from(handlers.keys())`) |

### Methods

#### `on(event, handler, priority?) → this`

Registers a handler for an event. Returns `this` for chaining.

- `priority` defaults to `10`. **Lower values run first.**
- Pushes `{ handler, priority }` to the event's array, then **sorts ascending by priority** after every registration.
- Throws `TypeError('Handler must be a function')` if handler is not a function.
- Multiple handlers per event allowed (array of entries).

#### `emit(event, ...args) → Promise<void>`

Executes all handlers for the given event **sequentially** (one `await` at a time, in priority order).

- If no handlers registered for the event, returns immediately.
- Arguments are passed by reference — handlers can mutate objects.
- **No error catching** — if a handler throws, the error propagates to the caller.

#### `off(event?, handler?)`

Three-mode removal:

1. **No arguments** `off()` — clears ALL handlers on ALL events (`handlers.clear()`).
2. **Event only** `off(event)` — removes ALL handlers for that event (`handlers.delete(event)`).
3. **Event + handler** `off(event, handler)` — removes a **specific handler** by reference equality (`findIndex` + `splice`). Cleans up empty arrays.

#### `withContext(context) → BoundChannelWrapper`

Returns a proxy-like object where handlers registered via `on()` are invoked with `handler.call(context, ...args)`.

**Wrapper shape:**
```javascript
{
  on(event, handler, priority?) → this,  // wraps handler, stores in WeakMap
  emit(event, ...args),                   // delegates to channel.emit()
  off(event),                            // delegates to channel.off(event)
  get name,                              // channel.name
  get events,                            // channel.events
}
```

**Implementation detail:** Uses a `WeakMap` to track the mapping from original handler → wrapped handler, so the wrapper doesn't leak references.

**Limitation:** The bound wrapper's `off()` only accepts `event` (not `event, handler`), so individual handler removal is not supported through the bound interface.

## 3. HookFactory Class (`factory.js`)

### Private State

- `Symbol('__rsk.hookChannels__')` → `Map<name, HookChannel>`

### Methods

| Method | Behavior |
|---|---|
| `channel(name)` | Lazy-creates `HookChannel` on first access. Trims name. Throws `Error` with `name: 'InvalidChannelNameError'` and `status: 400` if name is falsy or not a string. |
| `has(name)` | Checks map. Trims name. Returns `false` for invalid input. |
| `remove(name)` | Calls `channel.off()` (clear all handlers), deletes from map. Returns `false` if not found. |
| `getChannelNames()` | `Array.from(channels.keys())` |
| `cleanup()` | Calls `channel.off()` on every channel, then clears the map. |

## 4. Factory Function: `createFactory()`

**File:** `factory.js`

Creates a `HookFactory` instance and returns a callable function with all methods attached:

- `factory(name)` — shorthand for `factory.channel(name)`.
- `factory.channel(name)` — delegates to `manager.channel(name)`.
- `factory.has(name)`, `factory.remove(name)`, `factory.getChannelNames()`, `factory.cleanup()` — delegates to manager.

### `factory.withContext(context)`

Returns a **new callable factory** where every channel access returns a bound wrapper:

```javascript
const boundFactory = factory.withContext(ctx);
boundFactory('users')  // → channel.withContext(ctx)
boundFactory.channel('users')  // → same
```

The bound factory has all the same methods (`has`, `remove`, `getChannelNames`, `cleanup`), which delegate to the **same underlying manager**. The bound factory supports chaining: `boundFactory.withContext(newContext)` creates a new factory bound to the new context.

## 5. Default Singleton

**File:** `index.js`

### Named Exports
- `createFactory` — factory function for isolated instances
- `HookChannel` — class for type referencing

### Default Export
```javascript
const hook = createFactory();
export default hook;
```

The singleton is registered on the DI container as `app.get('container').resolve('hook')` during engine autoloading.

## 6. Error Handling

Unlike other engines, the hook engine has **no dedicated error class file**:

| Error | Thrown By | When |
|---|---|---|
| `TypeError('Handler must be a function')` | `HookChannel.on()`, bound wrapper `on()` | Non-function handler |
| `Error` with `name: 'InvalidChannelNameError'`, `status: 400` | `HookFactory.channel()` | Falsy or non-string name |

## 7. Testing

### `hook.test.js` (3 describe blocks)

**HookChannel:**
- Priority-ordered execution (lower priority first)
- Mutable data by reference
- Method chaining
- Handler removal (`off`)
- Event listing (`.events`)

**Factory:**
- Channel creation via callable factory
- Singleton instance return
- Channel tracking (`has`, `getChannelNames`)
- Channel removal
- Cleanup

**Default Export:**
- Callable factory returning `HookChannel` instance

### `hook.binding.test.js`

- `withContext()` handler receives context as `this`
- Payload passed through correctly

## 8. Integration Points

The hook engine is the **most widely used engine** across the codebase, with 50+ call sites:

- **Auth middleware**: `auth.permissions`, `auth.roles`, `auth.groups`, `auth.ownership`, `auth.strategy.{type}` — pluggable auth resolution.
- **User module**: Login, registration, profile updates, password changes — emit hooks for cross-module reactions.
- **Admin controllers**: User, role, permission, group CRUD — emit hooks for activity logging and cache invalidation.
- **Plugin lifecycle**: Plugin install/uninstall/toggle — emit hooks for system-wide notification.
- **Search module**: Listens for user/group hooks to update search indexes.
- **Email module**: Listens for user hooks to send transactional emails.
- **Activity module**: Listens for admin hooks to log audit trail entries.

### Common Pattern (service layer)

```javascript
const hook = app.get('container').resolve('hook');
await hook('users').emit('created', { user, context });
```

### Common Pattern (hooks registration)

```javascript
export default function registerHooks(app) {
  const hook = app.get('container').resolve('hook');
  hook('users').on('created', async (data) => {
    await sendWelcomeEmail(data.user);
  }, 10);
}
```

---

*Note: This spec reflects the CURRENT implementation of the hook engine.*
