/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Configuration
const CONFIG = {
  DEBUG: false,
  SHUTDOWN_UI_DELAY: 100,
  REDIRECT_DELAY: 500,
  BODY_CHECK_INTERVAL: 50,
  MESSAGE_PREFIX: 'browser_sync_',
  HEARTBEAT_TIMEOUT: 10000,
  RECONNECT_WAIT: 2000,
  INIT_RETRY_INTERVAL: 100, // Retry interval if hotClient not ready yet
  INIT_MAX_RETRIES: 50, // Max retries (5 seconds total)
};

/**
 * Logger utility for consistent logging with debug support
 */
const logger = {
  log: (...args) => {
    console.log('[BrowserSync]', ...args);
  },
  debug: (...args) => {
    if (CONFIG.DEBUG) {
      console.debug('[BrowserSync Debug]', ...args);
    }
  },
  warn: (...args) => {
    console.warn('[BrowserSync]', ...args);
  },
  error: (...args) => {
    console.error('[BrowserSync]', ...args);
  },
};

// State tracking
let lastMessageTime = Date.now();
let heartbeatInterval = null;
let isShuttingDown = false;
let unsubscribers = [];
let hotClient = null;

/**
 * Validate message data structure
 * @param {any} data - The data to validate
 * @returns {boolean} True if valid browser_sync message
 */
function isValidMessage(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (typeof data.type !== 'string') {
    return false;
  }

  if (!data.type.startsWith(CONFIG.MESSAGE_PREFIX)) {
    return false;
  }

  return true;
}

/**
 * Show the shutdown UI when server stops
 * @returns {Promise<void>}
 */
function showShutdownUI() {
  return new Promise(resolve => {
    const maxAttempts = 50;
    let attempts = 0;

    const attemptShow = () => {
      attempts++;

      if (!document.body) {
        if (attempts < maxAttempts) {
          setTimeout(attemptShow, CONFIG.BODY_CHECK_INTERVAL);
        } else {
          logger.warn('Timeout waiting for document.body');
          resolve();
        }
        return;
      }

      try {
        document.title = 'Server Stopped';

        const shutdownHTML = `
          <div style="
            background: #f0f0f0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, system-ui, sans-serif;
            color: #333;
            text-align: center;
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">🛑</div>
            <h1 style="margin: 0 0 8px;">Server Stopped</h1>
            <p style="margin: 0; color: #666;">You can close this tab.</p>
          </div>
        `;

        document.body.innerHTML = shutdownHTML;
        logger.debug('Shutdown UI displayed');
        resolve();
      } catch (err) {
        logger.error('Failed to show shutdown UI:', err);
        resolve();
      }
    };

    attemptShow();
  });
}

/**
 * Attempt to close the browser tab with multiple fallback strategies
 */
async function attemptClose() {
  logger.debug('Attempting to close tab...');

  try {
    window.close();
    logger.debug('Standard close attempted');
  } catch (err) {
    logger.warn('Standard close failed:', err);
  }

  try {
    window.open('', '_self');
    window.close();
    logger.debug('Context clear close attempted');
  } catch (err) {
    logger.warn('Context clear close failed:', err);
  }

  setTimeout(() => {
    try {
      logger.debug('Redirecting to about:blank');
      window.location.href = 'about:blank';
    } catch (err) {
      logger.error('Redirect to about:blank failed:', err);
    }
  }, CONFIG.REDIRECT_DELAY);
}

/**
 * Close the browser tab with UI feedback
 */
async function closeTab() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.log('Closing tab...');
  cleanup();

  try {
    await showShutdownUI();
    setTimeout(() => {
      attemptClose();
    }, CONFIG.SHUTDOWN_UI_DELAY);
  } catch (err) {
    logger.error('Error during tab close:', err);
    attemptClose();
  }
}

/**
 * Reload the page with error handling
 */
function reloadPage() {
  try {
    logger.log('Reloading page...');
    window.location.reload();
  } catch (err) {
    logger.error('Page reload failed:', err);
  }
}

/**
 * Handle server messages
 * @param {any} data - Message data from HMR client
 */
function handleMessage(data) {
  // Update heartbeat for any message (including webpack's own messages)
  lastMessageTime = Date.now();

  // Validate message structure
  if (!isValidMessage(data)) {
    logger.debug('Invalid or non-browser_sync message, ignoring');
    return;
  }

  logger.log('Received:', data.type);

  switch (data.type) {
    case 'browser_sync_server_restarting':
      logger.log('Server restarting...');
      break;

    case 'browser_sync_server_ready':
      if (
        data.action &&
        typeof data.action === 'string' &&
        data.action === 'reload'
      ) {
        reloadPage();
      } else {
        logger.log('Server ready');
      }
      break;

    case 'browser_sync_server_shutdown':
      logger.log('Server shutdown detected');
      closeTab();
      break;

    case 'browser_sync_reload':
      reloadPage();
      break;

    default:
      logger.debug('Unhandled message type:', data.type);
  }
}

/**
 * Handle HMR connection close/error
 */
function handleConnectionLoss() {
  if (isShuttingDown) return;

  logger.warn('HMR connection lost - checking if temporary...');

  let reconnected = false;

  setTimeout(() => {
    if (!reconnected && !isShuttingDown) {
      logger.log('Server connection not restored, closing tab...');
      closeTab();
    }
  }, CONFIG.RECONNECT_WAIT);

  const checkReconnect = () => {
    if (!hotClient) return;

    const readyState = hotClient.getReadyState();
    if (readyState === EventSource.OPEN) {
      reconnected = true;
      logger.log('✅ Connection restored');
    }
  };

  const reconnectInterval = setInterval(() => {
    if (reconnected || isShuttingDown) {
      clearInterval(reconnectInterval);
      return;
    }
    checkReconnect();
  }, 200);
}

/**
 * Start heartbeat monitor
 */
function startHeartbeatMonitor() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (isShuttingDown) return;

    const timeSinceLastMessage = Date.now() - lastMessageTime;

    if (timeSinceLastMessage > CONFIG.HEARTBEAT_TIMEOUT) {
      logger.warn(
        `No messages for ${timeSinceLastMessage}ms - connection lost`,
      );
      clearInterval(heartbeatInterval);
      handleConnectionLoss();
    }
  }, CONFIG.HEARTBEAT_TIMEOUT / 2);
}

/**
 * Cleanup resources
 */
function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  unsubscribers.forEach(unsub => {
    try {
      unsub();
    } catch (err) {
      logger.error('Error during unsubscribe:', err);
    }
  });
  unsubscribers = [];

  logger.debug('Cleanup completed');
}

/**
 * Initialize BrowserSync client
 */
function initialize() {
  let retries = 0;

  const attemptInit = () => {
    // Try to get hotClient from window (in case hotClient.js loaded first)
    hotClient = window.__hotClientAPI__;

    // Or try requiring it (if this loads first)
    if (!hotClient) {
      try {
        hotClient = require('../hotClient');
      } catch (err) {
        logger.debug('Could not require hotClient yet:', err);
      }
    }

    if (!hotClient) {
      retries++;
      if (retries < CONFIG.INIT_MAX_RETRIES) {
        logger.debug(
          `HMR client not ready yet, retrying... (${retries}/${CONFIG.INIT_MAX_RETRIES})`,
        );
        setTimeout(attemptInit, CONFIG.INIT_RETRY_INTERVAL);
        return;
      } else {
        logger.error('HMR client not available after max retries');
        return false;
      }
    }

    if (typeof hotClient.subscribe !== 'function') {
      logger.error('HMR client does not support subscribe method');
      return false;
    }

    try {
      // Subscribe to messages
      const unsubMessage = hotClient.subscribe(data => {
        logger.debug('HMR message received:', data);
        handleMessage(data);
      });
      unsubscribers.push(unsubMessage);

      // Subscribe to connection open
      const unsubOpen = hotClient.onOpen(() => {
        logger.log('✅ HMR connected');
        lastMessageTime = Date.now();
      });
      unsubscribers.push(unsubOpen);

      // Subscribe to errors
      const unsubError = hotClient.onError(error => {
        const readyState = hotClient.getReadyState();

        if (readyState === EventSource.CONNECTING) {
          logger.warn('🔄 HMR reconnecting...');
        } else if (readyState === EventSource.CLOSED) {
          logger.error('❌ HMR connection closed');
          handleConnectionLoss();
        } else {
          logger.debug('HMR error event:', error);
        }
      });
      unsubscribers.push(unsubError);

      // Start heartbeat monitoring
      startHeartbeatMonitor();

      logger.log('✅ Successfully subscribed to HMR events');
      return true;
    } catch (err) {
      logger.error('Failed to subscribe to HMR events:', err);
      return false;
    }
  };

  // Start initialization
  attemptInit();
}

// Initialize on script load
initialize();
