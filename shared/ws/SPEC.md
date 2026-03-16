# Shared WebSocket (WS) — Technical Specification

## Overview

The `shared/ws/` architecture implements an event-driven, token-authenticated, Pub/Sub WebSocket layer. It is split into `server/`, `client/`, and `utils/` sub-modules. It relies natively on the `ws` package on the server-side, and the native DOM `WebSocket` object on the client-side.

## Server implementation (`server/index.js`)

Constructs the `WebSocketServer` extending Node's `EventEmitter`.

### State Management
Utilizes Map collections to construct in-memory associative graphs linking connections and channels:
- `connections`: `connectionId -> WebSocket`
- `channels`: `channelName -> { type, subscribers: Set<connectionId>, metadata }`
- `connectionChannels`: `connectionId -> Set<channelName>`

### Authentication Strategy
1. **Cookie Intercept**: During the HTTP Upgrade handshake (`this.server.handleUpgrade`), it inspects request headers. If cookies exist (e.g. `id_token`), it invokes `this.config.onAuthentication`.
2. **Payload Intercept**: Alternatively, clients can transmit a `MessageType.AUTH_LOGIN` JSON payload containing the token. 
3. **Implicit Subscriptions**: Upon successful authentication, the server generates a unique `user:[userId]` Channel and forcefully subscribes the socket to both it and the global `protected` channel.

### Handlers
Custom Message handlers can be mapped via `registerHandler(type, callback)`. If an incoming payload lacks a mapped handler, it generically fires `.emit(EventType.MESSAGE, ws, message)`.

## Client implementation (`client/index.js`)

Constructs the `WebSocketClient` extending `events.EventEmitter` suitable for browser packing via Webpack/Vite.

### Connection Resilience
Handles disconnects aggressively. If `onclose` fires with any code differing from `1000` (Normal Closure), `_scheduleReconnect()` triggers a `setTimeout`. The delay length is `reconnectInterval * Math.min(reconnectAttempts, 5)` representing a linear backoff.

### The Queue
When `ws.send(type, data)` triggers while disconnected, it banks the JSON payload inside `this.messageQueue`. Upon the next successful `onopen` trigger, `_flushQueue()` unloads the queue synchronously across the wire. 

### React Integration
Exports `setWebSocketClient()` and `useWebSocket()` behaving as a crude global singleton getter, allowing deep nested React Hooks to grab the active socket without prop-drilling or Context encapsulation.
