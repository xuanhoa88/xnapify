# Hook Engine

Channel-based async pub/sub hooks with priority support and mutable arguments. Enables decoupled communication between modules via named event channels.

## Quick Start

```javascript
import hook from '@shared/api/engines/hook';

// Get or create a channel
const userHooks = hook('users');

// Register handlers
userHooks.on('created', async (user) => {
  await sendWelcomeEmail(user);
});

// Emit event (handlers run sequentially)
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
| `hook.remove('name')` | Remove a channel and clear its handlers |
| `hook.cleanup()` | Clear all channels |
| `hook.withContext(ctx)` | Create bound factory where handlers receive `ctx` as `this` |

### Channel

| Method | Description |
|---|---|
| `on(event, handler, priority?)` | Register handler (lower priority runs first, default `10`) |
| `emit(event, ...args)` | Execute all handlers sequentially (async) |
| `off(event?, handler?)` | Remove handlers (all, per-event, or specific) |
| `withContext(ctx)` | Create bound channel wrapper |
| `.events` | Get registered event names |
| `.name` | Get channel name |

### Priority Control

```javascript
userHooks.on('save', validateUser, 1);   // Runs first
userHooks.on('save', normalizeData, 10); // Runs second
userHooks.on('save', logActivity, 100);  // Runs last
```

### Isolated Instances

```javascript
import { createFactory } from '@shared/api/engines/hook';
const customHook = createFactory();
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
