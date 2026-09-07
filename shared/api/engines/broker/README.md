# Broker Engine AI Specification

> **Instructions for the AI:**
> Read this document to understand the internal architecture of the Broker
> Engine at `shared/api/engines/broker`.
> This engine is the shared backend for multi-instance deployments — it
> replaces what used to be a standalone `redis` engine — exposed behind a
> pluggable adapter interface instead of a specific client library.

---

## Objective

Give every consumer that needs to coordinate across worker processes a
single engine to depend on, split into two capabilities that are handled
very differently:

- **Pub/sub** — `publish(channel, payload)` / `subscribe(channel, onMessage)`.
  Genuinely transport-agnostic: a RabbitMQ, Kafka, or NATS adapter could
  implement just these two methods and WebSocket fan-out would not notice.
- **KV / atomic-mutex** — `getClient()` hands back a raw `ioredis`-compatible
  client for consumers that need real commands (`GET`/`SET PX`/`SCAN`,
  `SET NX`, ...): the shared cache, rate-limit counters, session revocation
  store, and the cron leader lock. No message broker is obligated to double
  as a key/value store or a mutex, so this half is only ever backed by the
  `redis` adapter. `getClient()` returns `null` on any adapter that cannot
  serve it (e.g. `memory`) — callers must check `isConfigured()` first.

Nothing outside `shared/api/engines/broker/adapters/redis.js` should import
`ioredis` directly. That is what keeps a future adapter for a different
broker technology a one-file change instead of a rewrite of every consumer.

## 1. Architecture

```text
shared/api/engines/broker/
├── index.js              # Singleton (auto-detected adapter), re-exports
├── lazy.js               # Defers adapter selection to first use (see below)
├── prefix.js             # Deployment namespace, shared by every adapter
├── factory.js            # createFactory({ type }) — adapter switch + auto-detect
├── errors.js             # BrokerError + InvalidBrokerTypeError
├── memoryClient.js        # In-memory ioredis stand-in, shared by every
│                          # Redis-backed adapter's tests (cache, auth
│                          # revocation, schedule lock, this engine's own)
├── adapters/
│   ├── memory.js         # In-process adapter (pub/sub only)
│   ├── file.js           # Cross-process on one host, via a shared directory
│   ├── file.test.js
│   ├── redis.js          # Owns the Redis connection lifecycle + KV escape hatch
│   └── redis.test.js
└── broker.test.js
```

## 2. The Adapter Contract

Every method here is **required** — the singleton facade (`lazy.js`) forwards
each one unconditionally, so an adapter that omits any fails with a
TypeError on first use. An adapter with nothing to offer for a method still
implements it and says so honestly, the way `MemoryBroker` does.

```javascript
class CustomBroker {
  /** @returns {boolean} Whether this adapter has a real backend configured */
  isConfigured() {}

  /**
   * @param {string} channel
   * @param {string} payload
   * @returns {Promise<void>}
   */
  async publish(channel, payload) {}

  /**
   * Resolves once the subscription is confirmed with the broker.
   * @param {string} channel
   * @param {(payload: string) => void} onMessage
   * @returns {Promise<() => Promise<void>>} Unsubscribe function
   */
  async subscribe(channel, onMessage) {}

  /** Raw KV/lock-capable client, or `null` if this adapter has none. */
  getClient() {}

  /** Namespace a logical channel for this deployment (may pass through). */
  channel(name) {}

  /** The namespace prefix in effect (`''` when nothing is namespaced). */
  getKeyPrefix() {}

  /** Subscribe to backend reconnects; returns a function that stops listening. */
  onReconnect(callback) {}

  /** Subscribe to the connection dying for good; same return contract. */
  onDisconnect(callback) {}

  /** Optional: release adapter-owned resources on shutdown. */
  async cleanup() {}
}
```

Notes for a new pub/sub-only adapter (RabbitMQ, Kafka, NATS, ...):

- Only `publish`/`subscribe`/`isConfigured` need real behaviour to serve
  WebSocket fan-out. `getClient()` can return `null` — nothing requires a
  broker adapter to also be a KV store — and `channel`/`getKeyPrefix`/
  `onReconnect`/`onDisconnect` can be the trivial implementations
  `MemoryBroker` uses.
- **If the transport can drop a subscription, `onDisconnect` must fire.** A
  consumer that subscribed once has no other way to learn its subscription
  died: nothing errors on the receive path, so messages simply stop arriving
  and the consumer keeps reporting itself attached. `RedisBroker` raises it
  from the subscriber's terminal `end` event and clears the dead connection
  so the next `subscribe()` builds a fresh one; the WebSocket fan-out wiring
  in `src/bootstrap/api/index.js` responds by detaching and re-attaching.
  An adapter whose delivery cannot fail this way (`MemoryBroker`) returns a
  no-op.
- `payload` is always a string (the caller `JSON.stringify`s before publish
  and `JSON.parse`s after). Binary/native message formats belong inside the
  adapter, not the interface.
- `subscribe` must not resolve until delivery is actually guaranteed to
  start — `attachPubSub` in `shared/ws/server/index.js` only marks itself
  attached after this promise settles, so a subscribe that resolves early
  can drop the first messages silently.
- The returned unsubscribe function must remove **only** the listener it
  registered. `RedisBroker` guards this with a per-call closure over a
  single `(channel, payload)` handler — see `adapters/redis.js` — because
  the underlying subscriber connection is shared and long-lived; a naive
  `removeAllListeners('message')` would kill every other subscription
  sharing that connection.
- A failed `subscribe` must leave no listener behind (see "never leaves a
  listener behind" in `adapters/redis.test.js`) — a half-attached
  subscription is worse than none, because callers read "did not throw" as
  "is receiving messages."
- Some brokers (Kafka, RabbitMQ with durable queues) have delivery semantics
  well beyond "fire and forget" — consumer groups, acks, offsets. This
  interface intentionally does not expose any of that; if a consumer needs
  those guarantees, it needs a different, richer interface, not an adapter
  pretending to be one.

## 3. Adapters

### `memory`

In-process only: `publish` on one instance only reaches `subscribe` calls on
that same instance, unless multiple instances share the same `bus` (an
`EventEmitter`, passed as `{ bus }`) — the trick tests use to simulate
several workers without touching the network. There is no cross-process
fan-out, and `getClient()`/`isConfigured()` are hard-wired to report "not
configured" — this adapter has no KV/lock surface. Correct for
single-instance deployments and for tests; wrong for anything running as a
cluster.

### `file`

Cross-process fan-out on **one host**, through a shared data directory —
the middle ground between `memory` (one process) and `redis` (any number of
hosts). Publishing writes a message file aside and `rename`s it in; each
subscriber scans the channel directory every `pollInterval` (default 200ms)
and delivers what it has not seen.

Semantics deliberately match Redis pub/sub, because the WebSocket fan-out is
written against exactly that: every live subscriber gets every message
(broadcast, unlike the queue engine's file adapter where one worker claims
each job), and **there is no replay** — a new subscriber records what is
already on disk and ignores it, so a restarted worker cannot re-apply an old
disconnect event. Messages are swept after `retentionMs` (default 30s); a
subscriber that stalls past that window can miss messages, and says so
(`fan-out … is behind`) rather than losing them quietly.

`channel()` namespaces with the deployment prefix, exactly as the `redis`
adapter does and for the same reason: the default data directory is
host-level, so two deployments that both leave `XNAPIFY_BROKER_DATA_DIR`
unset resolve the same path, and staging would deliver its `disconnectUser`
events into production. Cross-talk is indistinguishable from ordinary
traffic, so nothing would report it.

Two constraints it is easy to get wrong:

- **One host only.** Delivery rests on atomic `rename()` and trustworthy
  timestamps — the same properties the queue engine's file adapter
  documents, and the same ones NFS, SMB/CIFS and multi-host volumes do not
  provide. Use `redis` across hosts.
- **It does not make clustering safe without Redis.** It carries pub/sub
  only; `getClient()` is `null`, so the cache, rate-limit counters, session
  revocation store and cron lock all stay per-process. `shared/config/env.js`
  still refuses `XNAPIFY_CLUSTER_WORKERS > 1` without `XNAPIFY_REDIS_URL`,
  and `configureSharedBackends` logs a warning naming exactly what stayed
  local when it wires a broker with no KV client.

Never auto-detected: a data directory alone cannot say whether other
processes on the host are meant to hear these messages, so it is opt-in via
`XNAPIFY_BROKER_TYPE=file`.

### `redis`

Owns the entire connection lifecycle that used to live in the standalone
`redis` engine: it reads `XNAPIFY_REDIS_URL` / `XNAPIFY_REDIS_PREFIX`,
creates the command client and a dedicated subscriber connection lazily (so
constructing the adapter never opens a socket), and closes only the
connections it opened itself in `cleanup()` — a client/subscriber pair
handed in via `{ client, subscriber }` (dependency injection, mainly for
tests) is left for its owner to close.

```javascript
const broker = createFactory({ type: 'redis' }); // reads process.env
// or, for tests / advanced composition:
const broker = createFactory({ type: 'redis', client, subscriber });
```

Also provides:

- `broker.getClient()` — the shared command client, for consumers that need
  real Redis commands (cache, rate limiting, revocation, schedule lock).
- `broker.channel(name)` — namespaces a logical channel with the client's
  `keyPrefix`. Redis pub/sub is neither prefixed automatically nor
  database-scoped, so two deployments sharing one Redis instance need this
  to avoid cross-talk.
- `broker.onReconnect(callback)` — notifies `callback` whenever the
  subscriber connection (re)connects, the cheapest recovery signal ioredis
  gives; used to retry a failed `attachPubSub` sooner than a fixed interval
  would.

## 4. Configuration

`XNAPIFY_BROKER_TYPE` (`memory` | `file` | `redis`) selects the adapter
outright. Left blank it is inferred: `redis` when `XNAPIFY_REDIS_URL` is set,
`memory` otherwise — `file` is never inferred. `XNAPIFY_BROKER_DATA_DIR` is
the directory the `file` adapter's processes share (default
`.xnapify/broker` in dev, the OS data dir in production). All are validated
in `shared/config/env.js`.

**The environment is read on first use, never at import.** The singleton is
built while `shared/api/index.js` evaluates its engines context, and
snapshotting `process.env` there would freeze the choice before the
environment is necessarily complete — `src/server.js` loads
`dotenv-flow/config` first, but the `*.worker.js` bundles are separate rspack
entries that never do, and HMR re-evaluation or a test can observe a
different environment than the one in effect at first use. The failure would
be silent and security-relevant: the broker would keep the `memory` adapter
for the life of the process, leaving the session revocation set per-worker
so a revoked session stays live on every other worker — the exact state
`shared/config/env.js` refuses to cluster into. `lazy.js` defers the
decision, and `broker.test.js` ("reads the environment on first use") pins
it. `XNAPIFY_REDIS_PREFIX` namespaces
both regular keys (via ioredis's own `keyPrefix`) and pub/sub channels (via
`channel()`), so several deployments can share one Redis instance. No
broker-specific environment variables exist beyond these — they are the
same two the removed `redis` engine used, kept unchanged so operators do
not need to touch their deployment config for this refactor.

## 5. Shutdown

Each adapter registers its own `cleanup()` with the shutdown registry
(`shared/api/shutdown.js`) under a key numbered by creation order within the
module evaluation: the singleton is always the first adapter built and takes
`broker`; any extra instance takes `broker:1`, `broker:2`, and so on. The
registry is keyed by name and `Map.set` is idempotent — that is what makes an
HMR re-evaluation overwrite handlers instead of stacking them — so a second
adapter registering as a bare `broker` would silently replace the
singleton's handler and leave its Redis connections open at exit. Numbering
by creation order keeps re-evaluation idempotent *and* every adapter closed.

`RedisBroker.cleanup()` closes only the connections it opened itself; a
client/subscriber pair injected via `{ client, subscriber }` belongs to
whoever passed it in. A connection whose `quit()` rejects is force-closed
with `disconnect()`, so an unreachable Redis cannot hold the process open.

## 6. Security: this is a privileged capability

`broker` is listed in `PRIVILEGED_CAPABILITIES`
(`shared/extension/utils/compat.js`) and only resolves for a bundled or
operator-trusted extension. `getClient()` is a raw Redis connection with
write access to the cache, rate-limit counters, and — critically — the
session revocation store: writing through it is enough to un-revoke a
session. Anything that changes what `broker` can reach must keep this in
mind; do not widen extension access to it without the same scrutiny the
removed `redis` binding had.

## 7. Integration Points

- **`shared/ws/server/index.js`**: `attachPubSub({ broker, channel, instanceId })`
  publishes/subscribes through the broker instead of touching Redis
  directly. See that file's "CROSS-INSTANCE FAN-OUT" section.
- **`src/bootstrap/api/index.js`**: `configureSharedBackends` reads
  `engines.broker.isConfigured()` / `.getClient()` to wire the shared cache,
  rate limiter, revocation store, and schedule lock; `attachWebSocketFanOut`
  wires WebSocket fan-out through the same singleton via `.channel()` and
  `.onReconnect()`.
- **`shared/api/engines/cache`**, **`shared/api/engines/auth/revocation.js`**,
  **`shared/api/engines/schedule/lock.js`**: all take a raw client — sourced
  from `broker.getClient()` — rather than depending on this engine directly.

---

_Note: This spec reflects the CURRENT implementation of the broker engine._
