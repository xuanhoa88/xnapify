Setup WebSocket for real-time bidirectional communication.

## Overview

The application includes a robust, shared WebSocket implementation located in `src/shared/ws`.

- **Server**: Initialized in `src/server.js` and accessible via `app.get('ws')`.
- **Client**: Initialized in `src/client.js` and accessible via the `useWebSocket` utility.

## Server-Side Usage

The WebSocket server is already configured and running. You do **not** need to create a new server.

### 1. Accessing the WebSocket Server

In your API modules or routes, access the WebSocket server instance from the Express `app`:

```javascript
// @apps/chat/index.js
export default async function chatModule(app) {
  const ws = app.get('ws'); // Note: key is 'ws', not 'wss'

  if (ws) {
    // Access active connections
    // ws.connections is a Map<connectionId, WebSocket>
    console.log(`Active connections: ${ws.connections.size}`);
  }
}
```

### 1.1 Connection Identity (`connectionId`)

Each WebSocket connection is assigned a unique `connectionId` (UUID v4) upon connection. This ID is essential for targeting specific clients.

- **Server-side**: Accessed via `connection.id`.
- **Client-side**: Received in the `welcome` message or accessible via `ws.connectionId`.

```javascript
// Example: Targeting a specific connection
ws.sendToConnection(targetConnectionId, 'message:type', payload);
```

### 2. Handling Messages

Register a handler for a specific message type. The handler receives the WebSocket connection and the message payload.

```javascript
// @apps/chat/websocket.js
import { MessageType } from '@/shared/ws/server'; // or defined locally

export function initChatWebSocket(ws) {
  // Register handler for 'chat:send'
  ws.registerHandler('chat:send', async (connection, message) => {
    const { user } = connection;
    const { text, recipientId } = message.data;

    // Access DB models if needed (via require or dependency injection)
    // const { connection: dbData } = require('@/shared/api/db');

    console.log(`Received chat from ${user?.id}: ${text}`);

    // Send confirmation back
    ws.sendToConnection(connection.id, 'chat:ack', { status: 'sent' });
  });
}
```

### 3. Using Channels

The shared implementation supports channels for granular broadcasting.

**Channel Types:**

- `PUBLIC`: Accessible by anyone.
- `PROTECTED`: Requires valid authentication.
- `PRIVATE`: Specific to a user (`user:{id}`).

#### Public Channels

Public channels are accessible to all connected clients. A default `public` channel is created on server start.

```javascript
// Server: Send to the public channel (all connections)
ws.sendToPublicChannel('announcement', { text: 'Hello World' });

// Or use the generic sendToChannel method
ws.sendToChannel('public', 'announcement', { text: 'Hello World' });
```

#### Protected Channels

Protected channels are only accessible to authenticated users. A default `protected` channel is created on server start.

```javascript
// Server: Send to all authenticated users
ws.sendToProtectedChannel('system:alert', { message: 'Maintenance in 10m' });

// Client: Subscribe (must be authenticated)
ws.subscribe('protected');
```

#### Private Channels

Private channels (`user:{userId}`) are created automatically when a user authenticates.

```javascript
// Server: Send to a specific user's private channel
const userId = 'user-123';
// The server automatically subscribes the user to 'user:user-123' upon auth.

// Use the convenience method
ws.sendToPrivateChannel(userId, 'notification', {
  text: 'You have a new message',
});

// Or use the generic sendToChannel
ws.sendToChannel(`user:${userId}`, 'notification', {
  text: 'You have a new message',
});
```

### 4. Broadcasting

```javascript
// Broadcast to ALL connected clients
ws.broadcast('notification', { message: 'Server restarting...' });

// Broadcast to authenticated users only
ws.broadcast(
  'notification',
  { message: 'Hello Users' },
  conn => conn.authenticated,
);
```

## Client-Side Usage

The client is initialized in `src/client.js` and provides a singleton instance.

### 1. Using in React Components

Use the `useWebSocket` utility to access the client instance.

```javascript
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/shared/ws/client';

export default function ChatComponent() {
  const ws = useWebSocket();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!ws) return;

    // Define handler
    const handleMessage = data => {
      setMessages(prev => [...prev, data]);
    };

    // Subscribe to event
    // The client extends EventEmitter, so we use .on() / .off()
    ws.on('chat:message', handleMessage);

    // Cleanup
    return () => {
      ws.off('chat:message', handleMessage);
    };
  }, [ws]);

  const sendMessage = () => {
    ws?.send('chat:send', { text: 'Hello!' });
  };

  return <button onClick={sendMessage}>Send</button>;
}
```

### 2. Subscribing to Channels

```javascript
useEffect(() => {
  if (!ws) return;

  // Subscribe to channel
  ws.subscribe('room:general');

  // Listen for channel-specific messages
  const handleNext = payload => {
    // payload: { type, data }
    console.log('Channel message:', payload);
  };

  // Events are emitted as `channel:{channelName}`
  ws.on('channel:room:general', handleNext);

  return () => {
    ws.unsubscribe('room:general');
    ws.off('channel:room:general', handleNext);
  };
}, [ws]);
```

## Authentication

Authentication is handled automatically via cookies if `RSK_JWT_COOKIE_NAME` is set.

- **Auto-Auth**: On connection, the server checks the cookie.
- **Manual Auth**: Call `ws.login(token)` on the client.

## Shared Types & Constants

Import constants to ensure consistency.

```javascript
import { EventType, MessageType } from '@/shared/ws/client'; // or @/shared/ws/server
```

## Testing

Use the browser console to test the client instance:

```javascript
// In browser console
const ws = require('@/shared/ws/utils').useWebSocket(); // If exposed or accessible
// Since it's not global, you might need to trigger it via UI or temporary global exposure.
```
