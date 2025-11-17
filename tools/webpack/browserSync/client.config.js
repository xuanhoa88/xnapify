/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

(function () {
  if (typeof window === 'undefined') return;

  const CONFIG = {
    path: '/~/__bs',
    reconnectAttempts: 10,
    reconnectDelay: 500,
    reconnectBackoff: 1.3,
    pingInterval: 25000,
    closeDelay: 100, // Delay before closing tab
  };

  let ws = null;
  let reconnectCount = 0;
  let reconnectTimer = null;
  let pingTimer = null;
  let isServerRestarting = false;

  /**
   * Get WebSocket URL
   */
  function getWsUrl() {
    const { protocol, hostname, port } = window.location;
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort =
      port && port !== (wsProtocol === 'wss:' ? '443' : '80') ? `:${port}` : '';
    return `${wsProtocol}//${hostname}${wsPort}${CONFIG.path}`;
  }

  /**
   * Send message to server
   */
  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
        return true;
      } catch (err) {
        console.error('[BrowserSync] Send error:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Close the browser tab
   */
  function closeTab() {
    console.log('[BrowserSync] Closing tab...');

    // Try multiple methods to close the tab
    try {
      // Method 1: window.close() - works if opened via script
      window.close();

      // Method 2: If close() doesn't work, redirect to about:blank
      setTimeout(() => {
        window.location.href = 'about:blank';

        // Method 3: Last resort - try to close again
        setTimeout(() => {
          window.close();
        }, 100);
      }, 100);
    } catch (err) {
      console.error('[BrowserSync] Failed to close tab:', err);
      // If all methods fail, at least clear the page
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;">Dev server disconnected. You can close this tab.</div>';
    }
  }

  /**
   * Handle server messages
   */
  function handleMessage(data) {
    console.log('[BrowserSync] Received:', data.type);

    switch (data.type) {
      case 'browser_sync_connected':
        send({ type: 'browser_sync_client_ready', timestamp: Date.now() });
        break;

      case 'browser_sync_server_restarting':
        isServerRestarting = true;
        console.log('[BrowserSync] Server restarting...');
        break;

      case 'browser_sync_server_ready':
        isServerRestarting = false;
        if (data.action === 'reload') {
          console.log('[BrowserSync] Reloading page...');
          window.location.reload();
        } else {
          console.log('[BrowserSync] Server ready');
          reconnectCount = 0;
        }
        break;

      case 'browser_sync_server_shutdown':
        console.log('[BrowserSync] Server shutdown, closing tab...');
        setTimeout(closeTab, CONFIG.closeDelay);
        break;

      case 'browser_sync_reload':
        console.log('[BrowserSync] Reload requested');
        window.location.reload();
        break;

      case 'browser_sync_pong':
        // Server is alive
        break;

      default:
        console.log('[BrowserSync] Unknown message:', data.type);
    }
  }

  /**
   * Start ping interval
   */
  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      send({ type: 'browser_sync_ping', timestamp: Date.now() });
    }, CONFIG.pingInterval);
  }

  /**
   * Stop ping interval
   */
  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  /**
   * Handle disconnect and reconnect
   */
  function handleDisconnect(code) {
    console.warn(`[BrowserSync] Disconnected (code: ${code})`);
    stopPing();

    // If server is restarting, reset reconnect count
    if (isServerRestarting) {
      console.log('[BrowserSync] Waiting for server restart...');
      reconnectCount = 0;
    }

    // If we've exhausted reconnection attempts, close the tab
    if (reconnectCount >= CONFIG.reconnectAttempts) {
      console.log(
        '[BrowserSync] Max reconnect attempts reached, closing tab...',
      );
      setTimeout(closeTab, CONFIG.closeDelay);
      return;
    }

    // Attempt to reconnect
    reconnectCount++;
    const delay =
      CONFIG.reconnectDelay *
      Math.pow(CONFIG.reconnectBackoff, reconnectCount - 1);

    console.log(
      `[BrowserSync] Reconnecting in ${delay}ms (${reconnectCount}/${CONFIG.reconnectAttempts})`,
    );

    reconnectTimer = setTimeout(connect, delay);
  }

  /**
   * Connect to WebSocket server
   */
  function connect() {
    try {
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        console.log('[BrowserSync] Connected');
        reconnectCount = 0;
        isServerRestarting = false;
        startPing();
      };

      ws.onmessage = e => {
        try {
          handleMessage(JSON.parse(e.data));
        } catch (err) {
          console.error('[BrowserSync] Parse error:', err);
        }
      };

      ws.onclose = e => handleDisconnect(e.code);

      ws.onerror = err => console.error('[BrowserSync] Error:', err);
    } catch (err) {
      console.error('[BrowserSync] Connect failed:', err);
      handleDisconnect(1006);
    }
  }

  /**
   * Cleanup
   */
  function cleanup() {
    stopPing();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
  }

  /**
   * Initialize
   */
  function init() {
    connect();
    window.addEventListener('beforeunload', cleanup);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
