# Hook Engine

Channel-based async event hooks with priority ordering and mutable arguments. Enables decoupled inter-module communication — handlers run sequentially and can modify shared data by reference.

## Quick Start

```javascript
const hook = container.resolve('hook');

// Get or create a channel
const userHooks = hook('users');

// Register handlers (lower priority runs first)
userHooks.on('created', async (user) => {
  await sendWelcomeEmail(user);
}, 10);

// Emit event — handlers run sequentially
await userHooks.emit('created', { id: 1, name: 'John' });
```

## API

### Factory (callable as function)

| Method | Description |
|---|---|
| `hook('name')` | Get or create a channel (callable shorthand) |
| `hook.channel('name')` | Same as above |
| `hook.has('name')` | Check if channel exists |
| `hook.getChannelNames()` | List all channel names |
| `hook.remove('name')` | Remove channel and clear its handlers |
| `hook.cleanup()` | Clear all channels |
| `hook.withContext(ctx)` | Create bound factory where handlers receive `ctx` as `this` |

### Channel

| Method | Returns | Description |
|---|---|---|
| `on(event, handler, priority?)` | `this` | Register handler (lower priority runs first, default `10`) |
| `emit(event, ...args)` | `Promise<void>` | Execute handlers sequentially (Multicast, aggregates errors) |
| `invoke(event, ...args)`| `Promise<void>` | Execute handlers sequentially (Pipeline, fails fast on error) |
| `off()` | — | Remove ALL handlers on ALL events |
| `off(event)` | — | Remove all handlers for one event |
| `off(event, handler)` | — | Remove specific handler (by reference) |
| `.name` | `string` | Channel name |
| `.events` | `string[]` | Registered event names |

### Priority Control

```javascript
userHooks.on('save', validateUser, 1);   // Runs first
userHooks.on('save', normalizeData, 10); // Runs second
userHooks.on('save', logActivity, 100);  // Runs last
```

### Mutable Arguments

Handlers receive arguments by reference — mutations are visible to subsequent handlers:

```javascript
hook('transform').on('process', async (data) => {
  data.value *= 2;  // Mutates the original object
});

const data = { value: 5 };
await hook('transform').emit('process', data);
// data.value === 10
```

### Context Binding

Bind a context object so handlers receive it as `this`:

```javascript
// Factory-level binding (all channels)
const boundHook = hook.withContext(container);
boundHook('users').on('created', function (user) {
  // `this` === app
  const models = this.get('models');
});

// Channel-level binding
const boundChannel = hook('users').withContext(container);
```

### Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/hook';
const customHook = createFactory();
```

## Execution Modes & Cancellation

The engine provides two execution modes depending on your use case:

1. **`emit(event, ...args)` (Multicast/Pub-Sub)**: Evaluates all registered handlers. If one handler throws an error, it is safely caught and aggregated securely. Once all handlers finish executing, an `AggregateError` is thrown containing all caught errors.
2. **`invoke(event, ...args)` (Middleware/Pipeline)**: Evaluates handlers but **fails fast**. The very first handler to throw an error immediately halts the execution chain and propagates the error directly to the caller.

**Cancellation (`AbortSignal`)**:
Both `.emit()` and `.invoke()` automatically search for cancellation signals. If any argument has an `aborted` property set to `true` (such as `controller.signal.aborted`), the engine will cleanly bail out and push an `AbortError`.

```javascript
await hook('users').invoke('process', user, req.signal);
```

## Error Handling

- **Non-function handler:** `on()` throws `TypeError('Handler must be a function')`
- **Invalid channel name:** `channel()` throws `Error` with `name: 'InvalidChannelNameError'`
- **Handler errors:** 
  - `invoke()`: **Fails fast**. The first error thrown by a handler immediately propagates to the caller.
  - `emit()`: **Aggregates errors**. Catches all handler errors, ensures all hooks still run, and throws an `AggregateError` at the end.

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
