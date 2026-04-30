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
├── errors.js            # InvalidChannelNameError, HookAbortError, createAggregateError
├── hook.test.js         # Core tests
└── hook.binding.test.js # Context binding tests
```

### Dependency Graph

```
index.js
├── factory.js
│   ├── channel.js
│   └── errors.js
├── channel.js
│   └── errors.js
└── errors.js
```

No external dependencies.

## 2. HookChannel Class (`channel.js`)

### Private State

Internal state is stored via Symbols to prevent external access:
- `Symbol('__xnapify.hookName__')` → channel name string
- `Symbol('__xnapify.hookHandlers__')` → `Map<event, Array<{ handler, priority }>>`

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
- Uses **O(N) sequential insertion** to place `{ handler, priority }` directly in the correct priority order without re-sorting the entire array.
- Throws `TypeError('Handler must be a function')` if handler is not a function.
- Multiple handlers per event allowed (array of entries).

#### `emit(event, ...args) → Promise<void>`

Executes all handlers for the given event **sequentially** (one `await` at a time, in priority order). Best used for **Multicast / Pub-Sub** functionality where all handlers should run.

- If no handlers registered for the event, returns immediately.
- Arguments are passed by reference — handlers can mutate objects.
- **Cancellation Support**: If any of the `args` contains an `AbortSignal` (or any object with `.aborted` property set to `true`), the loop will break early and push an `AbortError`.
- **Aggregate Error Handling**: If a handler throws, the error is caught, and the rest of the handlers **still execute**. All caught errors are thrown at the end as an `AggregateError`.

#### `invoke(event, ...args) → Promise<void>`

Executes handlers **sequentially and fails fast** if any handler throws an exception. Best used for **Middleware Pipelines** (e.g. Auth checks, Validation).

- Functions identical to `emit()`, but **does not catch and aggregate errors**.
- The first handler to throw will immediately reject the promise and halt execution of subsequent hooks.
- **Cancellation Support**: Like `emit`, if `args` contains an aborted signal, halts immediately and throws an `AbortError`.

#### `off(event?, handler?)`

Three-mode removal:

1. **No arguments** `off()` — clears ALL handlers on ALL events (`handlers.clear()`).
2. **Event only** `off(event)` — removes ALL handlers for that event (`handlers.delete(event)`).
3. **Event + handler** `off(event, handler)` — removes a **specific handler** by reference equality (`filter`). Also checks against `ORIGINAL_HANDLER` symbol to match wrapped (bound) handlers to their originals. Cleans up empty arrays.

#### `withContext(context) → BoundChannelWrapper`

Returns a proxy-like object where handlers registered via `on()` are invoked with `handler.call(context, ...args)`.

**Wrapper shape:**
```javascript
{
  on(event, handler, priority?) → this,  // wraps handler with ORIGINAL_HANDLER tracking
  emit(event, ...args),                  // delegates to channel.emit()
  invoke(event, ...args),                // delegates to channel.invoke()
  off(event, handler?),                  // delegates to channel.off(event, handler?)
  withContext(newContext),               // creates a new bound wrapper with new context
  get name,                              // channel.name
  get events,                            // channel.events
}
```

**Implementation detail:** Each wrapped handler stores a `Symbol('__xnapify.hook.original__')` property pointing to the original handler function. This allows `off(event, handler)` to match the original reference against wrapped handlers without leaking references (no WeakMap needed).

**Individual handler removal is fully supported** through the bound interface via `off(event, handler)`. The `ORIGINAL_HANDLER` symbol on the wrapped function enables O(1) lookup of the original handler reference during removal.

## 3. HookFactory Class (`factory.js`)

### Private State

- `Symbol('__xnapify.hookChannels__')` → `Map<name, HookChannel>`

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

Creates a `HookFactory` instance, registers graceful shutdown handlers, and returns a callable function with all methods attached:

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

### Shutdown Registration

`createFactory()` registers cleanup with the centralized shutdown registry (`shared/api/shutdown.js`):
```javascript
register('hook', () => manager.cleanup());
```

This ensures all hook channels are cleaned up during coordinated process shutdown.

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

The singleton is registered on the DI container as `container.resolve('hook')` during engine autoloading.

## 6. Error Handling

**File:** `errors.js`

| Error Class | `name` | `code` | `statusCode` | Thrown By | When |
|---|---|---|---|---|---|
| `InvalidChannelNameError` | `'InvalidChannelNameError'` | `'ERR_INVALID_CHANNEL_NAME'` | `400` | `HookFactory.channel()` | Falsy or non-string name |
| `HookAbortError` | `'AbortError'` | `'ERR_HOOK_ABORTED'` | `499` | `emit()`, `invoke()` | AbortSignal detected as aborted |
| `TypeError` (built-in) | `'TypeError'` | — | — | `HookChannel.on()`, bound `on()` | Non-function handler |

### `createAggregateError(errors, message)`

Factory function that returns a native `AggregateError` on Node 17+, or a plain `Error` with `.errors` array on Node 16 (where `AggregateError` is undefined). Used by `emit()` when multiple handlers fail.

## 7. Testing

### `hook.test.js` (4 describe blocks, 31 tests)

**HookChannel (18 tests):**
- Priority-ordered execution (lower priority first)
- Mutable data by reference
- Method chaining
- Handler removal (`off` — all modes)
- Event listing (`.events`)
- Self-modifying handler list (mutation-safe iteration)
- Duplicate handler removal
- Single error propagation in `emit()`
- AggregateError in `emit()` with multiple failures
- Fail-fast `invoke()`
- AbortSignal cancellation in `emit()`
- No-handler `emit()` / `invoke()` (no-op resolution)
- Pre-aborted signal in `invoke()`
- Mid-flight abort in `invoke()`
- Clear-all `off()` (no args)
- TypeError for non-function handlers
- Safe `off()` on non-existent event/handler

**Factory (8 tests):**
- Channel creation via callable factory
- Singleton instance return
- Channel tracking (`has`, `getChannelNames`)
- Channel removal
- Cleanup
- Invalid name rejection
- `InvalidChannelNameError` properties (code, statusCode)
- Centralized shutdown registry registration

**Default Export (1 test):**
- Callable factory returning `HookChannel` instance

**Error Classes (3 tests):**
- `InvalidChannelNameError` properties and custom message
- `HookAbortError` properties

### `hook.binding.test.js` (4 tests)

- `withContext()` handler receives context as `this`
- Payload passed through correctly
- Individual handler removal via bound wrapper
- Multi-event handler removal
- `withContext` chaining

## 8. Integration Points

The hook engine is the **most widely used engine** across the codebase, with 50+ call sites:

- **Auth middleware**: `auth.permissions`, `auth.roles`, `auth.groups`, `auth.ownership`, `auth.strategy.{type}` — pluggable auth resolution.
- **User module**: Login, registration, profile updates, password changes — emit hooks for cross-module reactions.
- **Admin controllers**: User, role, permission, group CRUD — emit hooks for activity logging and cache invalidation.
- **Extension lifecycle: Extension install/uninstall/toggle — emit hooks for system-wide notification.
- **Search module**: Listens for user/group hooks to update search indexes.
- **Email module**: Listens for user hooks to send transactional emails.
- **Activity module**: Listens for admin hooks to log audit trail entries.

### Common Pattern (service layer)

```javascript
const hook = container.resolve('hook');
await hook('users').emit('created', { user, context });
```

### Common Pattern (hooks registration)

```javascript
export default function registerHooks(container) {
  const hook = container.resolve('hook');
  hook('users').on('created', async (data) => {
    await sendWelcomeEmail(data.user);
  }, 10);
}
```

---

*Note: This spec reflects the CURRENT implementation of the hook engine.*
