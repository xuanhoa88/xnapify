---
name: websocket-development
description: Build WebSocket features with channels, authentication, real-time messaging, and proper lifecycle management.
---

# WebSocket Developer Skill

This skill equips you to build real-time features using the `xnapify` WebSocket infrastructure at `shared/ws/`.

## Core Concepts

The WebSocket system uses a channel-based pub/sub model with built-in authentication, heartbeat monitoring, and graceful lifecycle management.

### Architecture

```
shared/ws/
├── server/
│   └── index.js          # WebSocketServer class (1000+ lines)
├── client/
│   └── index.js          # WebSocketClient class (browser-side)
└── utils/
    ├── constants.js      # MessageType, ChannelType, ErrorCode, CloseCode
    ├── logger.js          # createLogger utility
    └── index.js           # createMessage, parseMessage helpers
```

---

## Channel Types

| Type | Constant | Access | Auto-subscribe |
|------|----------|--------|----------------|
| `public` | `ChannelType.PUBLIC` | Everyone | ✅ On connect |
| `protected` | `ChannelType.PROTECTED` | Authenticated only | ✅ On auth success |
| `private` | `ChannelType.PRIVATE` | Specific user only | ✅ `user:<userId>` |

---

## Server-Side Patterns

### Sending Messages

```javascript
const ws = container.resolve('ws');

// Send to specific connection
ws.sendToConnection(connectionId, 'notification', { title: 'Hello' });

// Send to a channel (all subscribers)
ws.sendToChannel('public', 'announcement', { text: 'Server update' });

// Send to authenticated user's private channel
ws.sendToChannel(`user:${userId}`, 'notification', { text: 'New message' });

// Broadcast to all connections (with optional filter)
ws.broadcast('system:maintenance', { scheduledAt: '...' });
ws.broadcast('update', { data }, (conn) => conn.authenticated);
```

### Registering Custom Handlers

```javascript
// In module boot()
async boot({ container }) {
  const ws = container.resolve('ws');

  ws.registerHandler('chat:message', async (conn, message) => {
    if (!conn.authenticated) {
      return; // Silently ignore unauthenticated
    }
    const { channelId, text } = message.data;
    // Process and broadcast to channel
    ws.sendToChannel(channelId, 'chat:message', {
      userId: conn.user.id,
      text,
      timestamp: new Date().toISOString(),
    });
  });
}
```

### Creating Custom Channels

```javascript
// Public channel — anyone can subscribe
ws.createPublicChannel({ description: 'Live feed' });

// Protected channel — requires authentication
ws.createProtectedChannel({ description: 'Admin notifications' });

// Private user channel — auto-created on auth success
ws.createPrivateChannel(userId);
```

---

## Client-Side Patterns

### Using the WebSocket Client in React

```javascript
// In a React component
import { useEffect, useRef } from 'react';

function LiveNotifications() {
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WS server (auto-authenticates via cookie)
    const ws = new WebSocketClient({
      url: `ws://${window.location.host}/ws`,
    });

    ws.on('notification', (data) => {
      // Handle incoming notification
      console.log('Notification:', data);
    });

    ws.on('chat:message', (data) => {
      // Handle chat message
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      // MUST cleanup on unmount
      ws.disconnect();
      wsRef.current = null;
    };
  }, []);

  return <div>...</div>;
}
```

### Key Client Methods

| Method | Description |
|--------|-------------|
| `ws.connect()` | Open connection |
| `ws.disconnect()` | Close connection |
| `ws.send(type, data)` | Send message |
| `ws.on(type, handler)` | Listen for message type |
| `ws.off(type, handler)` | Remove listener |
| `ws.subscribe(channel)` | Subscribe to channel |
| `ws.unsubscribe(channel)` | Unsubscribe from channel |

---

## Authentication Flow

```
1. Client connects → receives WELCOME with connectionId
2. Server auto-checks cookies for JWT token (id_token)
3. If token found and valid → auto-authenticate
4. If no token → client sends AUTH_LOGIN with token
5. On success → subscribed to 'protected' + 'user:<id>' channels
6. On failure → AUTH_FAILED sent, connection closed after 1s
```

### Manual Authentication (Client)

```javascript
ws.send('auth:login', { token: jwtToken });
ws.on('auth:success', (data) => {
  console.log('Authenticated as:', data.user);
});
ws.on('auth:failed', (data) => {
  console.error('Auth failed:', data.message);
});
```

---

## Extension WebSocket Integration

Extensions can push real-time notifications by resolving the WS engine:

```javascript
// In extension boot()
async boot({ container, registry }) {
  const ws = container.resolve('ws');
  const hook = container.resolve('hook');

  // Listen for events and push WS notifications
  hook('orders').on('created', (order) => {
    ws.sendToChannel(`user:${order.userId}`, 'order:created', {
      orderId: order.id,
      status: order.status,
    });
  });
}

// In extension shutdown()
shutdown({ container, registry }) {
  // Hooks auto-cleaned by extension lifecycle
  // No WS-specific cleanup needed (handlers registered on hooks, not WS)
}
```

---

## Message Types (Built-in)

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `welcome` | Server → Client | Connection established |
| `ping` | Client → Server | Keep-alive request |
| `pong` | Server → Client | Keep-alive response |
| `auth:login` | Client → Server | Authenticate with JWT |
| `auth:success` | Server → Client | Auth succeeded |
| `auth:failed` | Server → Client | Auth failed |
| `auth:logout` | Client → Server | Logout |
| `channel:subscribe` | Client → Server | Join channel |
| `channel:subscribed` | Server → Client | Subscription confirmed |
| `channel:unsubscribe` | Client → Server | Leave channel |
| `channel:unsubscribed` | Server → Client | Unsubscription confirmed |
| `error` | Server → Client | Error message |

Custom message types (e.g., `chat:message`, `notification`) are handled via `registerHandler()`.

---

## Debugging

### Server-Side WS Inspection

```javascript
// In a debug middleware or controller
const ws = req.app.get('container').resolve('ws');
const stats = ws.getStats();
ws.connections.forEach((conn, id) => {
  console.log({ id, authenticated: conn.authenticated, user: conn.user });
});
```

### Client-Side

```javascript
// Browser console
// Check HMR WS endpoint
// HMR uses /~/__webpack_hmr (separate from app WS)
```

---

## Security Rules

| Rule | Implementation |
|------|---------------|
| **Auth on connect** | Auto-authenticate via httpOnly cookie |
| **Validate payloads** | `parseMessage()` rejects invalid JSON |
| **Channel access control** | Protected channels require auth, private requires user match |
| **Rate limiting** | Heartbeat interval detects dead connections |
| **No secrets in messages** | Never send tokens or passwords over WS |

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| Module integration | `module-development` skill |
| Extension integration | `extension-development` skill |
| Security audit | `security-compliance` skill |
| Frontend design | `frontend-design` skill |
| Debugging | `/debug` workflow |
