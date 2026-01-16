Setup WebSocket for real-time bidirectional communication.

## Overview

WebSocket server runs alongside Express, providing real-time communication between server and clients.

## Server-Side Setup

The WebSocket server is already initialized in `src/server.js`. To add custom event handlers:

### 1. Create WebSocket Handler

```javascript
// src/api/modules/chat/websocket.js
export function initChatWebSocket(wss, jwt) {
  // Store active connections
  const connections = new Map();

  wss.on('connection', (ws, req) => {
    const userId = req.user?.id;

    if (!userId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Store connection
    connections.set(userId, ws);
    console.log(`User ${userId} connected via WebSocket`);

    // Handle messages
    ws.on('message', async data => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'chat:send':
            await handleChatMessage(message.payload, userId, connections);
            break;
          case 'chat:typing':
            broadcastTyping(message.payload, userId, connections);
            break;
          default:
            ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      connections.delete(userId);
      console.log(`User ${userId} disconnected`);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        payload: { userId, timestamp: Date.now() },
      }),
    );
  });

  return { connections };
}

async function handleChatMessage(payload, senderId, connections) {
  const { recipientId, text } = payload;

  // Save to database
  const models = require('@/api/engines/db').default.models;
  const message = await models.Message.create({
    senderId,
    recipientId,
    text,
  });

  // Send to recipient if online
  const recipientWs = connections.get(recipientId);
  if (recipientWs && recipientWs.readyState === 1) {
    recipientWs.send(
      JSON.stringify({
        type: 'chat:message',
        payload: message,
      }),
    );
  }

  // Confirm to sender
  const senderWs = connections.get(senderId);
  if (senderWs) {
    senderWs.send(
      JSON.stringify({
        type: 'chat:sent',
        payload: message,
      }),
    );
  }
}

function broadcastTyping(payload, senderId, connections) {
  const { recipientId } = payload;
  const recipientWs = connections.get(recipientId);

  if (recipientWs && recipientWs.readyState === 1) {
    recipientWs.send(
      JSON.stringify({
        type: 'chat:typing',
        payload: { userId: senderId },
      }),
    );
  }
}
```

### 2. Initialize in Module

```javascript
// src/api/modules/chat/index.js
import { initChatWebSocket } from './websocket';

export default async function chatModule(deps, app) {
  const wss = app.get('wss');
  const jwt = app.get('auth').jwt;

  // Initialize WebSocket handlers
  const { connections } = initChatWebSocket(wss, jwt);

  // Store connections for use in HTTP routes
  app.set('chatConnections', connections);

  // ... rest of module setup
  console.info('✅ Chat module loaded');
  return router;
}
```

## Client-Side Setup

### 1. Create WebSocket Client

```javascript
// src/shared/ws/client.js
export function createWebSocketClient() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = getAuthToken(); // Get from cookie or localStorage

  const ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`);

  const eventHandlers = new Map();

  ws.onopen = () => {
    console.log('WebSocket connected');
    emit('connected');
  };

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      emit(message.type, message.payload);
    } catch (error) {
      console.error('WebSocket message parse error:', error);
    }
  };

  ws.onerror = error => {
    console.error('WebSocket error:', error);
    emit('error', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    emit('disconnected');

    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CLOSED) {
        window.location.reload();
      }
    }, 3000);
  };

  function emit(type, payload) {
    const handlers = eventHandlers.get(type) || [];
    handlers.forEach(handler => handler(payload));
  }

  function on(type, handler) {
    if (!eventHandlers.has(type)) {
      eventHandlers.set(type, []);
    }
    eventHandlers.get(type).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  function send(type, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  function close() {
    ws.close();
  }

  return { on, send, close, ws };
}

function getAuthToken() {
  // Get token from cookie
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
  return tokenCookie ? tokenCookie.split('=')[1] : null;
}
```

### 2. Use in React Component

```javascript
// src/pages/chat/ChatPage.js
import { useEffect, useState, useRef } from 'react';
import { createWebSocketClient } from '@/shared/ws/client';

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Create WebSocket connection
    const ws = createWebSocketClient();
    wsRef.current = ws;

    // Listen for messages
    const unsubscribeMessage = ws.on('chat:message', message => {
      setMessages(prev => [...prev, message]);
    });

    const unsubscribeTyping = ws.on('chat:typing', payload => {
      setTyping(true);
      setTimeout(() => setTyping(false), 3000);
    });

    const unsubscribeConnected = ws.on('connected', () => {
      console.log('Connected to chat');
    });

    // Cleanup
    return () => {
      unsubscribeMessage();
      unsubscribeTyping();
      unsubscribeConnected();
      ws.close();
    };
  }, []);

  const sendMessage = text => {
    wsRef.current?.send('chat:send', {
      recipientId: 'user-123',
      text,
    });
  };

  const handleTyping = () => {
    wsRef.current?.send('chat:typing', {
      recipientId: 'user-123',
    });
  };

  return (
    <div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{msg.text}</div>
        ))}
        {typing && <div>User is typing...</div>}
      </div>

      <input
        onChange={handleTyping}
        onKeyPress={e => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

export default ChatPage;
```

## Broadcasting to All Clients

```javascript
// Broadcast to all connected clients
function broadcastToAll(wss, message) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// Usage
broadcastToAll(wss, {
  type: 'notification',
  payload: { text: 'Server maintenance in 5 minutes' },
});
```

## Room/Channel Management

```javascript
// src/api/modules/chat/rooms.js
export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Set of userIds
    this.userRooms = new Map(); // userId -> Set of roomIds
  }

  joinRoom(userId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);

    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(roomId);
  }

  leaveRoom(userId, roomId) {
    this.rooms.get(roomId)?.delete(userId);
    this.userRooms.get(userId)?.delete(roomId);
  }

  getRoomUsers(roomId) {
    return Array.from(this.rooms.get(roomId) || []);
  }

  broadcastToRoom(roomId, message, connections) {
    const users = this.getRoomUsers(roomId);
    users.forEach(userId => {
      const ws = connections.get(userId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}
```

## Authentication

WebSocket authentication is handled in `src/server.js` via token verification:

```javascript
// Token is passed as query parameter: ws://localhost:1337/ws?token=xxx
// Server verifies token and attaches user to req.user
```

## Error Handling

```javascript
// Server-side
ws.on('error', error => {
  console.error('WebSocket error:', error);
});

// Client-side
ws.on('error', error => {
  console.error('Connection error:', error);
  // Show user-friendly error message
});
```

## Testing WebSocket

```javascript
// Manual testing with wscat
npm install -g wscat
wscat -c ws://localhost:1337/ws?token=YOUR_TOKEN

// Send message
> {"type":"chat:send","payload":{"recipientId":"123","text":"Hello"}}
```

## Best Practices

1. **Always authenticate** - Verify tokens before accepting connections
2. **Handle reconnection** - Implement auto-reconnect on client
3. **Validate messages** - Check message format and type
4. **Use message types** - Structured message format with type and payload
5. **Clean up connections** - Remove from maps on disconnect
6. **Handle errors gracefully** - Don't crash on invalid messages
7. **Rate limit** - Prevent spam/abuse
8. **Heartbeat/ping** - Keep connections alive
9. **Serialize data** - Use JSON for message format
10. **Store connections** - Use Map for O(1) lookups
