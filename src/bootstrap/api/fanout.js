/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * WebSocket cross-instance fan-out lifecycle.
 *
 * Extracted from the bootstrap module so it can be tested: every branch here
 * exists because of a failure that is invisible from the outside, and the
 * only way to know they still work is to exercise them.
 *
 *   - Attaching touches the socket, and ioredis rejects queued commands with
 *     MaxRetriesPerRequestError while Redis is down. Bootstrap must not fail
 *     on that, or an outage during a rolling deploy stops every new pod from
 *     starting. So: log, keep serving, retry.
 *   - A subscription that dies is silent. `ws.pubsub` stays truthy, nothing
 *     errors on the receive path, and remote messages simply stop arriving.
 *     The broker's disconnect signal is the only way to notice.
 *   - `attach()` guards on `ws.pubsub`, so recovery *requires* detaching
 *     first. Re-attaching without that is a no-op that looks like success.
 */

/** How often to retry attaching while the broker is unreachable. */
export const DEFAULT_RETRY_MS = 30_000;

/**
 * Attach WebSocket fan-out to a broker and keep it attached.
 *
 * @param {Object} options
 * @param {Object} options.ws - WebSocket server (`attachPubSub`/`detachPubSub`)
 * @param {Object} options.broker - Broker adapter
 * @param {string} options.channel - Channel to fan out on
 * @param {number} [options.retryMs] - Retry period while unavailable
 * @param {(message: string, level?: string) => void} [options.log]
 * @returns {{ started: Promise<void>, stop: () => void }} `started` resolves
 *   when the first attempt settles (it never rejects); `stop` cancels the
 *   retry and removes the broker hooks.
 */
export function attachFanOut({
  ws,
  broker,
  channel,
  retryMs = DEFAULT_RETRY_MS,
  log = () => {},
}) {
  let attaching = false;
  let retryTimer = null;

  const stopRetrying = () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  };

  const attach = async () => {
    // Already attached, or an attempt is in flight: a second one would
    // subscribe twice and apply every remote event twice.
    if (attaching || ws.pubsub) return;
    attaching = true;
    try {
      await ws.attachPubSub({ broker, channel });
      stopRetrying();
      log(`WebSocket fan-out attached on "${channel}"`);
    } catch (error) {
      log(
        `WebSocket fan-out unavailable (${error.message}) — ` +
          'running single-instance until the broker recovers',
        'error',
      );
      if (!retryTimer) {
        retryTimer = setInterval(() => {
          attach();
        }, retryMs);
        // Never hold the process open for a retry.
        if (typeof retryTimer.unref === 'function') retryTimer.unref();
      }
    } finally {
      attaching = false;
    }
  };

  // A reconnect is the cheapest recovery signal the broker gives us; it is a
  // no-op when the subscription survived the blip, because ioredis restores
  // its own subscriptions and `attach()` sees `ws.pubsub` still set.
  const stopReconnectHook = broker.onReconnect(() => attach());

  // Detach first: it clears `ws.pubsub`, which both stops the server from
  // reporting a subscription it no longer has and lets `attach()` run.
  const stopDisconnectHook = broker.onDisconnect(() => {
    log('WebSocket fan-out lost its subscription — re-attaching', 'error');
    Promise.resolve(ws.detachPubSub())
      .catch(() => {})
      .then(() => attach());
  });

  return {
    // Fire-and-forget for callers that must not await a socket; awaited by
    // tests, and by anything that wants to know the first attempt is done.
    started: attach(),
    stop() {
      stopRetrying();
      stopReconnectHook();
      stopDisconnectHook();
    },
  };
}

export default attachFanOut;
