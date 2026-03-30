/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const HMR_API_KEY = '__xnapify_hmr_api__';

// Only intercept EventSource once
if (!window[HMR_API_KEY]) {
  let eventSourceInstance = null;
  const messageHandlers = [];
  const errorHandlers = [];
  const openHandlers = [];

  // Intercept EventSource before webpack-hot-middleware creates it
  const OriginalEventSource = window.EventSource;

  window.EventSource = function (url, config) {
    eventSourceInstance = new OriginalEventSource(url, config);

    // Attach event listeners
    eventSourceInstance.addEventListener('open', e => {
      openHandlers.forEach(handler => {
        try {
          handler(e);
        } catch (err) {
          console.error('[HotClient] Error in open handler:', err);
        }
      });
    });

    eventSourceInstance.addEventListener('message', e => {
      try {
        const data = JSON.parse(e.data);
        messageHandlers.forEach(handler => {
          try {
            handler(data, e);
          } catch (err) {
            console.error('[HotClient] Error in message handler:', err);
          }
        });
      } catch (err) {
        // Non-JSON message, pass raw data
        messageHandlers.forEach(handler => {
          try {
            handler(e.data, e);
          } catch (err) {
            console.error('[HotClient] Error in message handler:', err);
          }
        });
      }
    });

    eventSourceInstance.addEventListener('error', e => {
      errorHandlers.forEach(handler => {
        try {
          handler(e);
        } catch (err) {
          console.error('[HotClient] Error in error handler:', err);
        }
      });
    });

    return eventSourceInstance;
  };

  // Store API in window for global access
  window[HMR_API_KEY] = {
    /**
     * Subscribe to all HMR messages
     * @param {Function} handler - Callback function that receives parsed message data
     * @returns {Function} Unsubscribe function
     */
    subscribe: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      messageHandlers.push(handler);

      // Return unsubscribe function
      return () => {
        const index = messageHandlers.indexOf(handler);
        if (index > -1) {
          messageHandlers.splice(index, 1);
        }
      };
    },

    /**
     * Listen for connection errors
     * @param {Function} handler - Callback function for error events
     * @returns {Function} Unsubscribe function
     */
    onError: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      errorHandlers.push(handler);

      return () => {
        const index = errorHandlers.indexOf(handler);
        if (index > -1) {
          errorHandlers.splice(index, 1);
        }
      };
    },

    /**
     * Listen for connection open
     * @param {Function} handler - Callback function for open events
     * @returns {Function} Unsubscribe function
     */
    onOpen: handler => {
      if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
      }
      openHandlers.push(handler);

      return () => {
        const index = openHandlers.indexOf(handler);
        if (index > -1) {
          openHandlers.splice(index, 1);
        }
      };
    },

    /**
     * Get the EventSource instance
     * @returns {EventSource|null}
     */
    getEventSource: () => eventSourceInstance,

    /**
     * Get connection state
     * @returns {number} EventSource.CONNECTING (0), OPEN (1), or CLOSED (2)
     */
    getReadyState: () => {
      return eventSourceInstance
        ? eventSourceInstance.readyState
        : EventSource.CLOSED;
    },
  };
}

// Load webpack-hot-middleware client
require('webpack-hot-middleware/client?path=/~/__webpack_hmr&timeout=20000&reload=true&overlay=false');

// Export the API (will be available via window or via module.exports)
module.exports = window[HMR_API_KEY];
