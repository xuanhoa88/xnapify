# Queue Engine

Channel-based pub/sub for background job processing with priority, delays, retry logic, concurrency control, and pluggable adapters.

## Quick Start

```javascript
const queue = app.get('queue');

// Create/get a channel (consumer)
const notifications = queue('notifications', { concurrency: 5 });
notifications.on('email', async (job) => {
  await sendEmail(job.data);
});

// Emit event (producer)
queue.channel('notifications').emit('email', { to: 'user@example.com' });
```

## API

### Factory

| Method | Description |
|---|---|
| `queue('name', options?)` | Get or create a channel |
| `queue.channel('name')` | Same as above |
| `queue.has('name')` | Check if channel exists |
| `queue.getChannelNames()` | List all channel names |
| `queue.getStats()` | Stats for all channels |
| `queue.remove('name')` | Remove a channel |
| `queue.cleanup()` | Close all channels (auto on process exit) |
| `queue.registerAdapter('type', Adapter)` | Register custom adapter |

### Channel

| Method | Description |
|---|---|
| `on(event, handler)` | Register job handler |
| `emit(event, data, options?)` | Publish a job |

### Custom Adapters

```javascript
queue.registerAdapter('redis', RedisQueueAdapter);
const channel = queue('jobs', { type: 'redis' });
```

### Isolated Instances

```javascript
const testQueue = queue.createFactory({ type: 'memory' });
```

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
