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
          <style>
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          </style>
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
            <p style="margin: 0 0 16px; color: #666;">Waiting for server to restart...</p>
            <p style="margin: 0; color: #999; font-size: 14px; animation: pulse 2s infinite;">This page will reload automatically</p>
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
 * Attempt to close the browser tab
 * @returns {boolean} True if close was successful
 */
function attemptClose() {
  try {
    logger.debug('Attempting to close tab...');
    // Standard close
    window.close();
  } catch (err) {
    logger.debug('Standard close failed:', err);
  }

  // Schedule a check to see if we're still here
  setTimeout(() => {
    logger.debug('Window still open, trying alternative method');
    try {
      const tab = window.open('', '_self');
      if (tab && typeof tab.close === 'function') tab.close();
    } catch (err) {
      logger.debug('Alternative close failed:', err);
    }
  }, 100);

  return false;
}

/**
 * Wait for server to come back online and reload
 */
function waitForReconnect() {
  const POLL_INTERVAL = 2000;
  const MAX_POLLS = 300; // 10 minutes max
  let pollCount = 0;

  logger.log('Waiting for server to restart...');

  const checkServer = async () => {
    pollCount++;

    if (pollCount > MAX_POLLS) {
      logger.warn('Server did not restart within timeout');
      return;
    }

    try {
      // Try to fetch the page to check if server is back
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-store',
      });

      if (response.ok) {
        logger.log('Server is back online, reloading...');
        window.location.reload();
        return;
      }
    } catch (err) {
      // Server not ready yet, continue polling
      logger.debug(`Poll ${pollCount}: Server not ready`);
    }

    setTimeout(checkServer, POLL_INTERVAL);
  };

  // Start polling after a short delay
  setTimeout(checkServer, POLL_INTERVAL);
}

/**
 * Handle server shutdown: try to close tab, if fails show UI and wait for reconnect
 */
async function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.log('Server shutdown detected');
  cleanup();

  // Try to close the tab first
  attemptClose();

  // If we're still here, tab couldn't be closed
  // Show shutdown UI and wait for server to come back
  await showShutdownUI();
  waitForReconnect();
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
      handleShutdown();
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
      handleShutdown();
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
    // eslint-disable-next-line no-underscore-dangle
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

        // Notify server that a client has connected (to cancel pending browser open)
        fetch('/~/__bs_connected', { method: 'POST' }).catch(() => {
          // Ignore errors - server may not have this endpoint
        });
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
