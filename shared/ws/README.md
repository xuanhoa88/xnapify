# Shared WebSocket (WS)

An isomorphic WebSocket library providing a robust Server and Client implementation with built-in JWT authentication, auto-reconnection, channel subscriptions (Pub/Sub pattern), and message queuing.

## Quick Start

### Server (`server/index.js`)

```javascript
import { WebSocketServer } from '@shared/ws/server';

// 1. Initialize server
const wss = new WebSocketServer({
  path: '/ws',
  onAuthentication: async (token, connectionId) => {
    // Validate JWT and return a user object containing at least `{ id }`
    const user = await verifyToken(token);
    return user;
  }
});

// 2. Start server and bind to HTTP server
wss.start(httpServer);

// 3. Create channels
wss.createPublicChannel({ description: 'Global chat' });
wss.createProtectedChannel({ description: 'Authenticated users only' });

// 4. Hook into events
wss.on('connection', (ws) => console.log('New connection:', ws.id));
wss.on('authenticated', (ws, user) => console.log('User joined:', user.id));

// 5. Broadcast
wss.broadcast('notification', { text: 'Hello World!' });
```

### Client (`client/index.js`)

```javascript
import { createWebSocketClient } from '@shared/ws/client';

// 1. Initialize client
const ws = createWebSocketClient({
  url: 'ws://localhost:8080/ws',
  autoReconnect: true,
});

// 2. Connect
ws.connect();

// 3. Listen to connection events
ws.on('connected', () => {
  // 4. Authenticate
  ws.login('my-jwt-token-string');
});

// 5. Listen to auth success and subscribe to channels
ws.on('authenticated', (user) => {
  ws.subscribe('public');
  ws.subscribe('protected');
});

// 6. Receive channel messages
ws.on('channel:message', ({ channel, type, data }) => {
  console.log(`[${channel}] ${type}:`, data);
});

// 7. Send custom messages
ws.send('chat:send', { text: 'Hello!' });
```

## Features

- **Isomorphic Core**: Emits standardized `EventType` and `MessageType` string enums across both ends to avoid string littering.
- **Auto-authentication**: The Server intercepts the HTTP Upgrade request, parsing cookies. If a valid `id_token` cookie exists, it automatically authenticates the socket without requiring a `login` payload.
- **Robust Client Retry**: Includes exponential backoff for disconnects, dropping failed attempts after `maxReconnectAttempts` (default: 10).
- **Message Queuing**: If `.send()` is called while the client is reconnecting, messages are buffered in memory and flushed automatically once re-established.
- **Pub/Sub Channels**: Includes `ChannelType.PUBLIC`, `ChannelType.PROTECTED`, and `ChannelType.PRIVATE`. The server forces access controls directly at the subscription layer.
- **Heartbeat Management**: Configurable bi-directional ping/pong to drop phantom connections.

## See Also
- [SPEC.md](./SPEC.md) — Technical specification
