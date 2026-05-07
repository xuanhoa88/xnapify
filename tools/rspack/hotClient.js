/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Client-side HMR transport for rspack.
 *
 * Creates an EventSource connection to the HMR SSE endpoint and:
 * 1. Applies module updates via `module.hot.check()` on "built" events
 * 2. Triggers full page reload when HMR cannot apply (structural changes)
 * 3. Exposes a pub/sub API so BrowserSync and other consumers can
 *    subscribe to HMR messages without touching the transport layer.
 */

const HMR_PATH = '/~/__hmr';
const HMR_API_KEY = '__xnapify_hmr_api__';

// Only initialise once (survives HMR self-updates)
if (!window[HMR_API_KEY]) {
  let eventSource = null;
  const messageHandlers = [];
  const errorHandlers = [];
  const openHandlers = [];

  // ---------------------------------------------------------------------------
  // HMR update logic
  // ---------------------------------------------------------------------------

  /**
   * Apply an HMR update from the server.
   * Falls back to a full page reload when the update can't be applied.
   */
  function applyUpdate(data) {
    if (data.errors && data.errors.length > 0) {
      // Don't attempt HMR when the build has errors — the error overlay
      // (or console) will display them.
      console.error('[HMR] Build errors:', data.errors);
      return;
    }

    const hotAPI =
      import.meta.webpackHot || (typeof module !== 'undefined' && module.hot);
    if (!hotAPI || typeof hotAPI.status !== 'function') return;

    const status = hotAPI.status();
    if (status !== 'idle') return;

    hotAPI
      .check(/* autoApply */ true)
      .then(updatedModules => {
        if (!updatedModules || updatedModules.length === 0) {
          // Nothing to update — hash may have changed but no hot-updatable
          // modules were affected. This is normal and not an error.
          return;
        }
        console.log(`[HMR] Updated ${updatedModules.length} module(s)`);
      })
      .catch(err => {
        const hmrStatus = hotAPI.status();
        if (hmrStatus === 'abort' || hmrStatus === 'fail') {
          console.warn('[HMR] Cannot apply update, full reload required');
          window.location.reload();
        } else {
          console.warn('[HMR] Update check failed:', err);
        }
      });
  }

  // ---------------------------------------------------------------------------
  // SSE connection
  // ---------------------------------------------------------------------------

  function connect() {
    eventSource = new EventSource(HMR_PATH);

    eventSource.addEventListener('open', e => {
      openHandlers.forEach(handler => {
        try {
          handler(e);
        } catch (handlerErr) {
          console.error('[HotClient] Error in open handler:', handlerErr);
        }
      });
    });

    eventSource.addEventListener('message', e => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (_parseErr) {
        data = e.data;
      }

      // Forward to all subscribers (BrowserSync, extensions, etc.)
      messageHandlers.forEach(handler => {
        try {
          handler(data, e);
        } catch (handlerErr) {
          console.error('[HotClient] Error in message handler:', handlerErr);
        }
      });

      // Apply HMR if this is a build event
      if (data && data.action === 'built') {
        applyUpdate(data);
      }
    });

    eventSource.addEventListener('error', e => {
      errorHandlers.forEach(handler => {
        try {
          handler(e);
        } catch (handlerErr) {
          console.error('[HotClient] Error in error handler:', handlerErr);
        }
      });
    });
  }

  // Connect immediately (this file is prepended to client entries)
  connect();

  // ---------------------------------------------------------------------------
  // Public API (consumed by BrowserSync client, extensions, etc.)
  // ---------------------------------------------------------------------------

  window[HMR_API_KEY] = {
    /**
     * Subscribe to all HMR messages.
     * @param {Function} handler - Callback receiving parsed message data
     * @returns {Function} Unsubscribe function
     */
    subscribe: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      messageHandlers.push(handler);
      return () => {
        const index = messageHandlers.indexOf(handler);
        if (index > -1) messageHandlers.splice(index, 1);
      };
    },

    /**
     * Listen for connection errors.
     * @param {Function} handler - Callback for error events
     * @returns {Function} Unsubscribe function
     */
    onError: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      errorHandlers.push(handler);
      return () => {
        const index = errorHandlers.indexOf(handler);
        if (index > -1) errorHandlers.splice(index, 1);
      };
    },

    /**
     * Listen for connection open.
     * @param {Function} handler - Callback for open events
     * @returns {Function} Unsubscribe function
     */
    onOpen: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      openHandlers.push(handler);
      return () => {
        const index = openHandlers.indexOf(handler);
        if (index > -1) openHandlers.splice(index, 1);
      };
    },

    /**
     * Get the EventSource instance.
     * @returns {EventSource|null}
     */
    getEventSource: () => eventSource,

    /**
     * Get connection state.
     * @returns {number} EventSource.CONNECTING (0), OPEN (1), or CLOSED (2)
     */
    getReadyState: () =>
      eventSource ? eventSource.readyState : EventSource.CLOSED,
  };
}

export default window[HMR_API_KEY];
