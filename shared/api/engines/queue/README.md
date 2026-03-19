# Queue Engine

Channel-based pub/sub for background job processing with priority, delays, retry with exponential backoff, concurrency control, and pluggable adapters.

## Quick Start

```javascript
const queue = app.get('container').resolve('queue');

// Create a channel and register handler (consumer)
const notifications = queue('notifications', { concurrency: 5 });
notifications.on('email', async (job) => {
  await sendEmail(job.data);
});

// Emit a job (producer)
queue.channel('notifications').emit('email', {
  to: 'user@example.com',
  subject: 'Welcome',
});
```

## API

### Factory

The factory is **callable** — `queue('name')` creates or returns a channel. `queue.channel('name')` is lookup-only.

| Method | Returns | Description |
|---|---|---|
| `queue('name', options?)` | `Channel\|null` | Create or get a channel |
| `queue.channel('name')` | `Channel\|null` | Get existing channel only (returns `null` if not found) |
| `queue.has('name')` | `boolean` | Check if channel exists |
| `queue.getChannelNames()` | `string[]` | List all channel names |
| `queue.getStats()` | `object` | Stats for all channels |
| `queue.remove('name')` | `Promise<boolean>` | Close and remove a channel |
| `queue.cleanup()` | `Promise<void>` | Close all channels (auto on process exit) |
| `queue.registerAdapter('type', Adapter)` | `boolean` | Register custom adapter (won't override existing) |

### Channel

| Method | Returns | Description |
|---|---|---|
| `on(event, handler)` | `this` | Register job handler (chainable) |
| `off(event)` | `this` | Remove handler (chainable) |
| `emit(event, data?, options?)` | `Job\|null` | Publish a job |
| `emitBulk(events)` | `Job[]` | Publish multiple jobs |
| `hasHandler(event)` | `boolean` | Check if handler exists |
| `getHandlerCount()` | `number` | Number of registered handlers |
| `getStats()` | `object` | Channel statistics |
| `close()` | `Promise<void>` | Close channel and release resources |

### Job Options

Options passed to `emit(event, data, options)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `priority` | `number` | `0` | Higher = processed first |
| `delay` | `number` | `0` | Delay in ms before processing |
| `attempts` | `number` | `3` | Max retry attempts |
| `backoff` | `number` | `1000` | Base backoff in ms (exponential) |
| `removeOnComplete` | `boolean` | `true` | Auto-remove on success |
| `removeOnFail` | `boolean` | `false` | Auto-remove on final failure |

### Job Object

The handler receives a job context with:

```javascript
notifications.on('email', async (job) => {
  job.id;          // UUID
  job.name;        // Event name
  job.data;        // Your payload
  job.attempts;    // Current attempt number

  // Report progress (0-100)
  job.updateProgress(50);
});
```

### JOB_STATUS

```javascript
import { JOB_STATUS } from '@shared/api/engines/queue';
// { PENDING, ACTIVE, COMPLETED, FAILED, DELAYED, PAUSED }
```

### Error Classes

```javascript
import { QueueError, JobNotFoundError, JobProcessingError, QueueConnectionError }
  from '@shared/api/engines/queue/errors';
```

## Retry Behavior

Failed jobs are retried with exponential backoff: `backoff × 2^(attempt-1)`.

```
Attempt 1 fails → wait 1s  → retry
Attempt 2 fails → wait 2s  → retry
Attempt 3 fails → FAILED (max attempts reached)
```

## Custom Adapters

```javascript
class RedisQueue {
  constructor(options) { /* { name, concurrency, ... } */ }
  add(event, data, options) { /* → Job */ }
  process(handler) { /* handler = async (job) => result */ }
  close() { /* → Promise */ }
  getStats() { /* → object */ }
}

queue.registerAdapter('redis', RedisQueue);
const channel = queue('jobs', { type: 'redis' });
```

## Isolated Instances

For testing or plugins with independent lifecycle:

```javascript
import { createFactory } from '@shared/api/engines/queue';

const testQueue = createFactory({ type: 'memory', concurrency: 2 });
const channel = testQueue('test-channel');
channel.on('event', async (job) => { /* ... */ });
```

## Integration with Schedule Engine

```javascript
const notifications = queue('notifications', { concurrency: 10 });
notifications.on('email', async (job) => {
  await sendEmail(job.data);
});

schedule.register('daily-digest', '0 9 * * *', () => {
  queue.channel('notifications').emit('email', {
    template: 'digest',
    to: 'users@example.com',
  });
});
```

## See Also

- [SPEC.md](./SPEC.md) — Full internal architecture specification
