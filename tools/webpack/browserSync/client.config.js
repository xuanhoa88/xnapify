/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { logInfo, logWarn, logError, logDebug } from '../../lib/logger';

// Configuration
const CONFIG = Object.freeze({
  DEBUG: false,
  SHUTDOWN_UI_DELAY: 100,
  REDIRECT_DELAY: 500,
  BODY_CHECK_INTERVAL: 50,
  MESSAGE_PREFIX: 'browser_sync_',
  HEARTBEAT_TIMEOUT: 10000,
  RECONNECT_WAIT: 2000,
  INIT_RETRY_INTERVAL: 100, // Retry interval if hotClient not ready yet
  INIT_MAX_RETRIES: 50, // Max retries (5 seconds total)
  SCROLL_STORAGE_KEY: '__bs_scroll_position',
  SCROLL_RESTORE_DELAY: 100, // Delay before restoring scroll position
});

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
          logWarn('[BrowserSync] Timeout waiting for document.body');
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
        logInfo('[BrowserSync] Shutdown UI displayed');
        resolve();
      } catch (err) {
        logError('[BrowserSync] Failed to show shutdown UI:', err);
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
    logInfo('[BrowserSync] Attempting to close tab...');
    // Standard close
    window.close();
  } catch (err) {
    logError('[BrowserSync] Standard close failed:', err);
  }

  // Schedule a check to see if we're still here
  setTimeout(() => {
    logInfo('[BrowserSync] Window still open, trying alternative method');
    try {
      const tab = window.open('', '_self');
      if (tab && typeof tab.close === 'function') tab.close();
    } catch (err) {
      logError('[BrowserSync] Alternative close failed:', err);
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

  logInfo('[BrowserSync] Waiting for server to restart...');

  const checkServer = () => {
    pollCount++;

    if (pollCount > MAX_POLLS) {
      logWarn('[BrowserSync] Server did not restart within timeout');
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', window.location.href);
    xhr.setRequestHeader('Cache-Control', 'no-store');

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        logInfo('[BrowserSync] Server is back online, reloading...');
        reloadPage();
      } else {
        setTimeout(checkServer, POLL_INTERVAL);
      }
    };

    xhr.onerror = () => {
      logDebug(`[BrowserSync] Poll ${pollCount}: Server not ready`);
      setTimeout(checkServer, POLL_INTERVAL);
    };

    try {
      xhr.send();
    } catch (err) {
      setTimeout(checkServer, POLL_INTERVAL);
    }
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

  logInfo('[BrowserSync] Server shutdown detected');
  cleanup();

  // Try to close the tab first
  attemptClose();

  // If we're still here, tab couldn't be closed
  // Show shutdown UI and wait for server to come back
  await showShutdownUI();
  waitForReconnect();
}

/**
 * Save current scroll position to sessionStorage
 */
function saveScrollPosition() {
  try {
    const scrollData = {
      x: window.scrollX,
      y: window.scrollY,
      path: window.location.pathname + window.location.search,
    };
    sessionStorage.setItem(
      CONFIG.SCROLL_STORAGE_KEY,
      JSON.stringify(scrollData),
    );
    logDebug('[BrowserSync] Saved scroll position:', scrollData);
  } catch (err) {
    logWarn('[BrowserSync] Failed to save scroll position:', err);
  }
}

/**
 * Restore scroll position from sessionStorage if path matches
 */
function restoreScrollPosition() {
  try {
    const stored = sessionStorage.getItem(CONFIG.SCROLL_STORAGE_KEY);
    if (!stored) return;

    const scrollData = JSON.parse(stored);
    const currentPath = window.location.pathname + window.location.search;

    // Only restore if we're on the same path
    if (scrollData.path === currentPath) {
      // Use requestAnimationFrame to ensure DOM is rendered
      setTimeout(() => {
        window.scrollTo(scrollData.x, scrollData.y);
        logDebug('[BrowserSync] Restored scroll position:', scrollData);
      }, CONFIG.SCROLL_RESTORE_DELAY);
    }

    // Clean up after restoring
    sessionStorage.removeItem(CONFIG.SCROLL_STORAGE_KEY);
  } catch (err) {
    logWarn('[BrowserSync] Failed to restore scroll position:', err);
    sessionStorage.removeItem(CONFIG.SCROLL_STORAGE_KEY);
  }
}

/**
 * Reload the page with error handling, preserving current location and scroll
 */
function reloadPage() {
  try {
    // Save scroll position before reload
    saveScrollPosition();

    // Get current full path
    const currentPath =
      window.location.pathname + window.location.search + window.location.hash;
    logInfo('[BrowserSync] Reloading page at:', currentPath);

    // Navigate to the current path to force reload
    window.location.href = currentPath;
  } catch (err) {
    logError('[BrowserSync] Page reload failed:', err);
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
    logDebug('[BrowserSync] Invalid or non-browser_sync message, ignoring');
    return;
  }

  logInfo('[BrowserSync] Received:', data.type);

  switch (data.type) {
    case 'browser_sync_server_restarting':
      logInfo('[BrowserSync] Server restarting...');
      break;

    case 'browser_sync_server_ready':
      if (
        data.action &&
        typeof data.action === 'string' &&
        data.action === 'reload'
      ) {
        reloadPage();
      } else {
        logInfo('[BrowserSync] Server ready');
      }
      break;

    case 'browser_sync_server_shutdown':
      logInfo('[BrowserSync] Server shutdown detected');
      handleShutdown();
      break;

    case 'browser_sync_reload':
      reloadPage();
      break;

    default:
      logDebug('[BrowserSync] Unhandled message type:', data.type);
  }
}

/**
 * Handle HMR connection close/error
 */
function handleConnectionLoss() {
  if (isShuttingDown) return;

  logWarn('[BrowserSync] HMR connection lost - checking if temporary...');

  let reconnected = false;

  setTimeout(() => {
    if (!reconnected && !isShuttingDown) {
      logInfo('[BrowserSync] Server connection not restored, closing tab...');
      handleShutdown();
    }
  }, CONFIG.RECONNECT_WAIT);

  const checkReconnect = () => {
    if (!hotClient) return;

    const readyState = hotClient.getReadyState();
    if (readyState === EventSource.OPEN) {
      reconnected = true;
      logInfo('[BrowserSync] Connection restored');
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
      logWarn(
        `[BrowserSync] No messages for ${timeSinceLastMessage}ms - connection lost`,
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
      logError('[BrowserSync] Error during unsubscribe:', err);
    }
  });
  unsubscribers = [];

  logInfo('[BrowserSync] Cleanup completed');
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
        logDebug('[BrowserSync] Could not require hotClient yet:', err);
      }
    }

    if (!hotClient) {
      retries++;
      if (retries < CONFIG.INIT_MAX_RETRIES) {
        logDebug(
          `[BrowserSync] HMR client not ready yet, retrying... (${retries}/${CONFIG.INIT_MAX_RETRIES})`,
        );
        setTimeout(attemptInit, CONFIG.INIT_RETRY_INTERVAL);
        return;
      } else {
        logError('[BrowserSync] HMR client not available after max retries');
        return false;
      }
    }

    if (typeof hotClient.subscribe !== 'function') {
      logError('[BrowserSync] HMR client does not support subscribe method');
      return false;
    }

    try {
      // Subscribe to messages
      const unsubMessage = hotClient.subscribe(data => {
        logDebug('[BrowserSync] HMR message received:', data);
        handleMessage(data);
      });
      unsubscribers.push(unsubMessage);

      // Subscribe to connection open
      const unsubOpen = hotClient.onOpen(() => {
        logInfo('[BrowserSync] HMR connected');
        lastMessageTime = Date.now();

        // Notify server that a client has connected (to cancel pending browser open)
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/~/__bs_connected');
          xhr.send();
        } catch (err) {
          // Ignore errors - server may not have this endpoint
        }
      });
      unsubscribers.push(unsubOpen);

      // Subscribe to errors
      const unsubError = hotClient.onError(error => {
        const readyState = hotClient.getReadyState();

        if (readyState === EventSource.CONNECTING) {
          logWarn('[BrowserSync] HMR reconnecting...');
        } else if (readyState === EventSource.CLOSED) {
          logError('[BrowserSync] HMR connection closed');
          handleConnectionLoss();
        } else {
          logDebug('[BrowserSync] HMR error event:', error);
        }
      });
      unsubscribers.push(unsubError);

      // Start heartbeat monitoring
      startHeartbeatMonitor();

      logInfo('[BrowserSync] Successfully subscribed to HMR events');
      return true;
    } catch (err) {
      logError('[BrowserSync] Failed to subscribe to HMR events:', err);
      return false;
    }
  };

  // Start initialization
  attemptInit();

  // Restore scroll position if saved from previous reload
  if (document.readyState === 'complete') {
    restoreScrollPosition();
  } else {
    window.addEventListener('load', restoreScrollPosition, { once: true });
  }
}

// Initialize on script load
initialize();
