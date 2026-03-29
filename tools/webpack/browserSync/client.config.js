/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const { logInfo, logWarn, logError, logDebug } = require('../../utils/logger');

// Configuration
const CONFIG = Object.freeze({
  DEBUG: false,
  REDIRECT_DELAY: 500,
  BODY_CHECK_INTERVAL: 50,
  MESSAGE_PREFIX: 'browser_sync_',
  HEARTBEAT_TIMEOUT: 10_000,
  RECONNECT_WAIT: 8_000,
  INIT_RETRY_INTERVAL: 100,
  INIT_MAX_RETRIES: 50,
  SCROLL_STORAGE_KEY: '__bs_scroll_position',
  SCROLL_RESTORE_DELAY: 100,
  POLL_INTERVAL: 5_000,
  MAX_POLLS: 120, // 10 minutes max
  BANNER_ID: '__bs_reconnect_banner',
  BANNER_MIN_DISPLAY: 5_000,
});

// Banner CSS (injected once)
const BANNER_STYLES = `
  @keyframes bsSlideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes bsSlideUp {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(-100%); opacity: 0; }
  }
  @keyframes bsPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes bsSpin {
    to { transform: rotate(360deg); }
  }
  #__bs_reconnect_banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    background: rgba(24, 24, 27, 0.96);
    border-bottom: 2px solid #dc2626;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1;
    animation: bsSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  #__bs_reconnect_banner.bs-dismissing {
    animation: bsSlideUp 0.25s ease-in forwards;
  }
  #__bs_reconnect_banner .bs-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    max-width: 960px;
    margin: 0 auto;
  }
  #__bs_reconnect_banner .bs-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dc2626;
    animation: bsPulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }
  #__bs_reconnect_banner .bs-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(250,250,250,0.2);
    border-top-color: #fafafa;
    border-radius: 50%;
    animation: bsSpin 0.8s linear infinite;
    flex-shrink: 0;
  }
  #__bs_reconnect_banner .bs-msg {
    flex: 1;
    color: #d4d4d8;
  }
  #__bs_reconnect_banner .bs-msg strong {
    color: #fafafa;
    font-weight: 600;
  }
  #__bs_reconnect_banner .bs-try {
    background: none;
    border: 1px solid rgba(250,250,250,0.2);
    color: #fafafa;
    padding: 5px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }
  #__bs_reconnect_banner .bs-try:hover {
    background: rgba(250,250,250,0.1);
    border-color: rgba(250,250,250,0.35);
  }
  #__bs_reconnect_banner .bs-try:active {
    background: rgba(250,250,250,0.15);
  }
`;

// State tracking
let lastMessageTime = Date.now();
let heartbeatInterval = null;
let isShuttingDown = false;
let isReconnecting = false;
let unsubscribers = [];
let hotClient = null;
let bannerCountdownId = null;
let bannerShownAt = 0;
let styleElement = null;

/**
 * Validate message data structure
 * @param {any} data - The data to validate
 * @returns {boolean} True if valid browser_sync message
 */
function isValidMessage(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.type !== 'string') return false;
  return data.type.startsWith(CONFIG.MESSAGE_PREFIX);
}

/**
 * Inject banner styles into the document (idempotent)
 */
function injectStyles() {
  if (styleElement) return;
  styleElement = document.createElement('style');
  styleElement.id = '__bs_reconnect_styles';
  styleElement.textContent = BANNER_STYLES;
  (document.head || document.documentElement).appendChild(styleElement);
}

/**
 * Remove the reconnection banner with slide-up animation
 */
function dismissBanner() {
  if (bannerCountdownId) {
    clearInterval(bannerCountdownId);
    bannerCountdownId = null;
  }

  const banner = document.getElementById(CONFIG.BANNER_ID);
  if (!banner) return;

  banner.classList.add('bs-dismissing');
  banner.addEventListener('animationend', () => banner.remove(), {
    once: true,
  });
  // Fallback removal
  setTimeout(() => banner.remove(), 300);
}

/**
 * Show reconnection banner with countdown and "Try now" button
 * @param {number} countdownSec - seconds until next auto-retry
 * @param {function} onTryNow - callback when user clicks "Try now"
 */
function showReconnectionBanner(countdownSec, onTryNow) {
  const maxAttempts = 50;
  let attempts = 0;

  const attemptShow = () => {
    attempts++;
    if (!document.body) {
      if (attempts < maxAttempts) {
        setTimeout(attemptShow, CONFIG.BODY_CHECK_INTERVAL);
      } else {
        logWarn('[BrowserSync] Timeout waiting for document.body');
      }
      return;
    }

    try {
      injectStyles();

      // Remove existing banner if any
      const existing = document.getElementById(CONFIG.BANNER_ID);
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = CONFIG.BANNER_ID;

      let remaining = countdownSec;

      banner.innerHTML = `
        <div class="bs-inner">
          <span class="bs-dot"></span>
          <span class="bs-msg">
            <strong>Lost connection to server</strong>, reconnecting in <span class="bs-countdown">${remaining}s</span>
          </span>
          <button class="bs-try" type="button">Try now</button>
        </div>
      `;

      document.body.appendChild(banner);
      bannerShownAt = Date.now();

      // Countdown tick
      const countdownEl = banner.querySelector('.bs-countdown');
      bannerCountdownId = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(bannerCountdownId);
          bannerCountdownId = null;
          if (countdownEl) countdownEl.textContent = '…';
          return;
        }
        if (countdownEl) countdownEl.textContent = `${remaining}s`;
      }, 1000);

      // "Try now" button
      const tryBtn = banner.querySelector('.bs-try');
      if (tryBtn && onTryNow) {
        tryBtn.addEventListener(
          'click',
          () => {
            tryBtn.disabled = true;
            tryBtn.textContent = 'Checking…';

            // Replace dot with spinner
            const dot = banner.querySelector('.bs-dot');
            if (dot) {
              dot.className = 'bs-spinner';
              dot.style.animation = '';
            }

            onTryNow();
          },
          { once: true },
        );
      }

      document.title = '\u26A0 Connection Lost';
      logInfo('[BrowserSync] Reconnection banner displayed');
    } catch (err) {
      logError('[BrowserSync] Failed to show reconnection banner:', err);
    }
  };

  attemptShow();
}

/**
 * Show full-page "Server Stopped" screen (last resort after max poll timeout)
 */
function showServerStoppedScreen() {
  if (!document.body) return;

  dismissBanner();

  document.title = 'Server Stopped';
  document.body.innerHTML = `
    <div style="
      background: #18181b;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #fafafa;
      text-align: center;
    ">
      <div style="
        width: 48px; height: 48px; border-radius: 50%;
        background: rgba(220,38,38,0.15);
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 20px;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 600;">Server Stopped</h1>
      <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px;">
        The development server did not restart within the timeout period.
      </p>
      <button onclick="window.location.reload()" style="
        background: rgba(250,250,250,0.1);
        border: 1px solid rgba(250,250,250,0.2);
        color: #fafafa;
        padding: 8px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        transition: background 0.15s;
      " onmouseover="this.style.background='rgba(250,250,250,0.15)'"
         onmouseout="this.style.background='rgba(250,250,250,0.1)'">
        Reload Page
      </button>
    </div>
  `;
}

/**
 * Attempt to close the browser tab (best-effort)
 */
function attemptClose() {
  try {
    window.close();
  } catch (_) {
    // Modern browsers block window.close() for non-script-opened tabs
  }
}

/**
 * Wait for server to come back online with visible countdown
 */
function waitForReconnect() {
  let pollCount = 0;
  const pollIntervalSec = CONFIG.POLL_INTERVAL / 1000;

  logInfo('[BrowserSync] Waiting for server to restart...');

  const checkServer = () => {
    pollCount++;

    if (pollCount > CONFIG.MAX_POLLS) {
      logWarn('[BrowserSync] Server did not restart within timeout');
      showServerStoppedScreen();
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', window.location.href);
    xhr.setRequestHeader('Cache-Control', 'no-store');

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        logInfo('[BrowserSync] Server is back online, reloading...');

        // Notify server to cancel new tab opening
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/~/__bs_connected');
          } else {
            const notifyXhr = new XMLHttpRequest();
            notifyXhr.open('POST', '/~/__bs_connected', false);
            notifyXhr.send();
          }
        } catch (_) {
          // Ignore
        }

        dismissBanner();
        reloadPage();
      } else {
        scheduleNextPoll();
      }
    };

    xhr.onerror = () => {
      logDebug(`[BrowserSync] Poll ${pollCount}: Server not ready`);
      scheduleNextPoll();
    };

    try {
      xhr.send();
    } catch (_) {
      scheduleNextPoll();
    }
  };

  const scheduleNextPoll = () => {
    // Show/refresh the banner with countdown for the next poll interval
    showReconnectionBanner(pollIntervalSec, () => {
      logInfo('[BrowserSync] Manual reconnect triggered');
      checkServer();
    });
    setTimeout(checkServer, CONFIG.POLL_INTERVAL);
  };

  // Initial poll after a short delay, show banner immediately
  showReconnectionBanner(pollIntervalSec, () => {
    logInfo('[BrowserSync] Manual reconnect triggered');
    checkServer();
  });
  setTimeout(checkServer, CONFIG.POLL_INTERVAL);
}

/**
 * Handle server shutdown: try to close tab, if fails show banner and poll
 */
async function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logInfo('[BrowserSync] Server shutdown detected');
  cleanup();

  attemptClose();

  // If still here, tab couldn't be closed — show reconnection banner
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

    if (scrollData.path === currentPath) {
      setTimeout(() => {
        window.scrollTo(scrollData.x, scrollData.y);
        logDebug('[BrowserSync] Restored scroll position:', scrollData);
      }, CONFIG.SCROLL_RESTORE_DELAY);
    }

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
    saveScrollPosition();

    const currentPath =
      window.location.pathname + window.location.search + window.location.hash;
    logInfo('[BrowserSync] Reloading page at:', currentPath);

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
  lastMessageTime = Date.now();

  if (!isValidMessage(data)) {
    logDebug('[BrowserSync] Invalid or non-browser_sync message, ignoring');
    return;
  }

  logInfo('[BrowserSync] Received:', data.type);

  switch (data.type) {
    case 'browser_sync_server_restarting': {
      logInfo('[BrowserSync] Server restarting...');
      showReconnectionBanner(CONFIG.POLL_INTERVAL / 1000, null);
      break;
    }

    case 'browser_sync_server_ready': {
      const elapsed = Date.now() - bannerShownAt;
      const remaining = Math.max(0, CONFIG.BANNER_MIN_DISPLAY - elapsed);

      const onReady = () => {
        dismissBanner();
        if (
          data.action &&
          typeof data.action === 'string' &&
          data.action === 'reload'
        ) {
          reloadPage();
        } else {
          logInfo('[BrowserSync] Server ready');
        }
      };

      if (remaining > 0) {
        setTimeout(onReady, remaining);
      } else {
        onReady();
      }
      break;
    }

    case 'browser_sync_server_shutdown': {
      logInfo('[BrowserSync] Server shutdown detected');
      handleShutdown();
      break;
    }

    case 'browser_sync_reload': {
      reloadPage();
      break;
    }

    default:
      logDebug('[BrowserSync] Unhandled message type:', data.type);
  }
}

/**
 * Handle HMR connection close/error
 */
function handleConnectionLoss() {
  if (isShuttingDown || isReconnecting) return;
  isReconnecting = true;

  logWarn('[BrowserSync] HMR connection lost - checking if temporary...');

  let reconnected = false;

  setTimeout(() => {
    if (!reconnected && !isShuttingDown) {
      isReconnecting = false;
      logInfo('[BrowserSync] Server connection not restored, closing tab...');
      handleShutdown();
    }
  }, CONFIG.RECONNECT_WAIT);

  const checkReconnect = () => {
    if (!hotClient) return;

    const readyState = hotClient.getReadyState();
    if (readyState === EventSource.OPEN) {
      reconnected = true;
      isReconnecting = false;
      logInfo('[BrowserSync] Connection restored after temporary loss');

      // The browser_sync_server_ready message was likely sent while
      // the SSE connection was down and lost. Dismiss the banner and
      // reload so the client picks up the new server bundle.
      dismissBanner();

      // Reset heartbeat so future disconnections are detected
      lastMessageTime = Date.now();
      startHeartbeatMonitor();

      reloadPage();
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

  if (bannerCountdownId) {
    clearInterval(bannerCountdownId);
    bannerCountdownId = null;
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
    // Get hotClient from window (hotClient.js loads first as entry point)
    // eslint-disable-next-line no-underscore-dangle
    hotClient = window.__rsk_hmr_api__;

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
      const unsubMessage = hotClient.subscribe(data => {
        logDebug('[BrowserSync] HMR message received:', data);
        handleMessage(data);
      });
      unsubscribers.push(unsubMessage);

      const unsubOpen = hotClient.onOpen(() => {
        logInfo('[BrowserSync] HMR connected');
        lastMessageTime = Date.now();

        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/~/__bs_connected');
          xhr.send();
        } catch (_) {
          // Ignore
        }
      });
      unsubscribers.push(unsubOpen);

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

      startHeartbeatMonitor();

      logInfo('[BrowserSync] Successfully subscribed to HMR events');
      return true;
    } catch (err) {
      logError('[BrowserSync] Failed to subscribe to HMR events:', err);
      return false;
    }
  };

  attemptInit();

  if (document.readyState === 'complete') {
    restoreScrollPosition();
  } else {
    window.addEventListener('load', restoreScrollPosition, { once: true });
  }
}

// Initialize on script load
initialize();
